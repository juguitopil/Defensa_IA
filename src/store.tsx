import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { seedMails } from "./data/seed";
import { createGmailAdapter, fetchGmailAccount } from "./lib/adapters/gmail";
import { createMockAdapter } from "./lib/adapters/mock";
import type { MailAdapter } from "./lib/adapters/types";
import { ME } from "./lib/format";
import { fetchGoogleProfile, requestGoogleSession, revokeGmailToken } from "./lib/gmail/auth";
import { mergeAgent, requestAgentReview } from "./lib/security/agent";
import { analyzeMail } from "./lib/security/analyze";
import { resolveGoogleClientId } from "./lib/settings";
import type {
  Address,
  AgentStatus,
  Draft,
  FolderId,
  Mail,
  RiskFilter,
  SecurityReport,
} from "./types";

export type NavId = FolderId | "alerts";
export type MailSource = "mock" | "google" | "gmail";

interface ConfirmRequest {
  kind: "link" | "attachment";
  mailId: string;
  label: string;
  href?: string;
  attachmentId?: string;
}

interface State {
  mails: Mail[];
  selectedId: string | null;
  nav: NavId;
  riskFilter: RiskFilter;
  query: string;
  securityOpen: boolean;
  compose: Draft | null;
  ackHigh: Record<string, boolean>;
  confirm: ConfirmRequest | null;
  toast: string | null;
  mobilePane: "list" | "read";
  source: MailSource;
  account: Address;
  connecting: boolean;
  loadingMailbox: boolean;
  settingsOpen: boolean;
  mailboxError: string | null;
  agentConfigured: boolean;
  agentStatus: Record<string, AgentStatus>;
  agentReports: Record<string, SecurityReport>;
}

type Action =
  | { type: "select"; id: string | null }
  | { type: "nav"; nav: NavId }
  | { type: "query"; query: string }
  | { type: "risk"; riskFilter: RiskFilter }
  | { type: "security"; open?: boolean }
  | { type: "compose"; draft: Draft | null }
  | { type: "sent"; mail: Mail }
  | { type: "patch"; id: string; patch: Partial<Mail> }
  | { type: "remove"; id: string }
  | { type: "ack"; id: string }
  | { type: "confirm"; confirm: ConfirmRequest | null }
  | { type: "toast"; message: string | null }
  | { type: "mobile"; pane: "list" | "read" }
  | { type: "mailbox"; mails: Mail[]; source: MailSource; account: Address }
  | { type: "connecting"; value: boolean }
  | { type: "loadingMailbox"; value: boolean }
  | { type: "settings"; open: boolean }
  | { type: "mailboxError"; message: string | null }
  | { type: "agentConfigured"; value: boolean }
  | { type: "agentStatus"; id: string; status: AgentStatus }
  | { type: "agentReport"; report: SecurityReport }
  | { type: "addMail"; mail: Mail };

const initialMails = seedMails.map((mail) => ({ ...mail }));

const initial: State = {
  mails: initialMails,
  selectedId: initialMails.find((mail) => mail.folder === "inbox")?.id ?? null,
  nav: "inbox",
  riskFilter: "all",
  query: "",
  securityOpen: typeof window === "undefined" || window.innerWidth >= 1280,
  compose: null,
  ackHigh: {},
  confirm: null,
  toast: null,
  mobilePane: "list",
  source: "mock",
  account: ME,
  connecting: false,
  loadingMailbox: false,
  settingsOpen: false,
  mailboxError: null,
  agentConfigured: true,
  agentStatus: {},
  agentReports: {},
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select":
      return {
        ...state,
        selectedId: action.id,
        mobilePane: action.id ? "read" : "list",
        mails: state.mails.map((mail) =>
          mail.id === action.id ? { ...mail, unread: false } : mail,
        ),
      };
    case "nav":
      return { ...state, nav: action.nav, selectedId: null, mobilePane: "list" };
    case "query":
      return { ...state, query: action.query };
    case "risk":
      return { ...state, riskFilter: action.riskFilter };
    case "security":
      return { ...state, securityOpen: action.open ?? !state.securityOpen };
    case "compose":
      return { ...state, compose: action.draft };
    case "sent":
      return {
        ...state,
        mails: [action.mail, ...state.mails],
        compose: null,
        toast:
          state.source === "gmail"
            ? "Guardado en Enviados locales. Gmail está en solo lectura, no se envió."
            : "Correo enviado a Enviados (simulado).",
        nav: "sent",
        selectedId: action.mail.id,
        mobilePane: "read",
      };
    case "patch":
      return {
        ...state,
        mails: state.mails.map((mail) =>
          mail.id === action.id ? { ...mail, ...action.patch } : mail,
        ),
      };
    case "remove":
      return {
        ...state,
        mails: state.mails.filter((mail) => mail.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
        toast: "Eliminado de forma permanente.",
      };
    case "ack":
      return { ...state, ackHigh: { ...state.ackHigh, [action.id]: true } };
    case "confirm":
      return { ...state, confirm: action.confirm };
    case "toast":
      return { ...state, toast: action.message };
    case "mobile":
      return { ...state, mobilePane: action.pane };
    case "mailbox":
      return {
        ...state,
        mails: action.mails,
        source: action.source,
        account: action.account,
        selectedId: action.mails.find((mail) => mail.folder === "inbox")?.id ?? action.mails[0]?.id ?? null,
        nav: "inbox",
        query: "",
        ackHigh: {},
        agentReports: {},
        agentStatus: {},
        mailboxError: null,
        connecting: false,
        loadingMailbox: false,
        settingsOpen: false,
        mobilePane: "list",
      };
    case "connecting":
      return { ...state, connecting: action.value };
    case "loadingMailbox":
      return { ...state, loadingMailbox: action.value };
    case "settings":
      return { ...state, settingsOpen: action.open };
    case "mailboxError":
      return { ...state, mailboxError: action.message, connecting: false, loadingMailbox: false };
    case "agentConfigured":
      return { ...state, agentConfigured: action.value };
    case "agentStatus":
      return { ...state, agentStatus: { ...state.agentStatus, [action.id]: action.status } };
    case "agentReport":
      return {
        ...state,
        agentReports: { ...state.agentReports, [action.report.mailId]: action.report },
        agentStatus: { ...state.agentStatus, [action.report.mailId]: action.report.agent.status },
      };
    case "addMail":
      return {
        ...state,
        mails: [action.mail, ...state.mails],
        selectedId: action.mail.id,
        nav: "inbox",
        settingsOpen: false,
        mobilePane: "read",
        toast: "Correo importado. El agente lo está revisando.",
      };
    default:
      return state;
  }
}

function visibleMails(
  mails: Mail[],
  reports: Record<string, SecurityReport>,
  nav: NavId,
  riskFilter: RiskFilter,
  query: string,
): Mail[] {
  const q = query.trim().toLowerCase();
  return mails
    .filter((mail) => {
      if (nav === "starred") return mail.starred && mail.folder !== "trash";
      if (nav === "alerts") {
        const level = reports[mail.id]?.level;
        return (
          mail.folder !== "trash" &&
          mail.folder !== "drafts" &&
          (level === "high" || level === "medium")
        );
      }
      return mail.folder === nav;
    })
    .filter((mail) => {
      if (riskFilter === "all") return true;
      return reports[mail.id]?.level === riskFilter;
    })
    .filter((mail) => {
      if (!q) return true;
      return (
        mail.subject.toLowerCase().includes(q) ||
        mail.from.name.toLowerCase().includes(q) ||
        mail.from.email.toLowerCase().includes(q) ||
        mail.bodyText.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

interface StoreValue {
  state: State;
  reports: Record<string, SecurityReport>;
  list: Mail[];
  selected: Mail | null;
  report: SecurityReport | null;
  unreadInbox: number;
  alertCount: number;
  counts: Record<NavId, number>;
  select: (id: string | null) => void;
  setNav: (nav: NavId) => void;
  setQuery: (query: string) => void;
  setRisk: (filter: RiskFilter) => void;
  toggleSecurity: (open?: boolean) => void;
  openCompose: (draft?: Partial<Draft>) => void;
  closeCompose: () => void;
  sendCompose: (draft: Draft) => Promise<void>;
  toggleStar: (id: string) => void;
  toggleRead: (id: string) => void;
  archive: (id: string) => void;
  trash: (id: string) => void;
  ackHigh: (id: string) => void;
  askConfirm: (confirm: ConfirmRequest) => void;
  closeConfirm: () => void;
  clearToast: () => void;
  backToList: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  connectGmail: () => Promise<void>;
  disconnectGmail: () => void;
  refreshAgentStatus: () => Promise<void>;
  importMail: (mail: Mail) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function MailProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const tokenRef = useRef("");
  const adapterRef = useRef<MailAdapter>(createMockAdapter());
  const askedRef = useRef<Set<string>>(new Set());

  const reports = useMemo(() => {
    return Object.fromEntries(
      state.mails.map((mail) => {
        if (state.agentReports[mail.id]) return [mail.id, state.agentReports[mail.id]];
        const base = analyzeMail(mail);
        const status = state.agentStatus[mail.id] ?? "idle";
        return [mail.id, { ...base, agent: { ...base.agent, status } }];
      }),
    );
  }, [state.mails, state.agentReports, state.agentStatus]);

  const list = useMemo(
    () => visibleMails(state.mails, reports, state.nav, state.riskFilter, state.query),
    [state.mails, reports, state.nav, state.riskFilter, state.query],
  );
  const selected = state.mails.find((mail) => mail.id === state.selectedId) ?? null;
  const report = selected ? reports[selected.id] ?? null : null;

  const counts = useMemo(() => {
    const base = {
      inbox: 0,
      starred: 0,
      sent: 0,
      drafts: 0,
      archive: 0,
      trash: 0,
      alerts: 0,
    } satisfies Record<NavId, number>;
    for (const mail of state.mails) {
      base[mail.folder] += 1;
      if (mail.starred && mail.folder !== "trash") base.starred += 1;
      const level = reports[mail.id]?.level;
      if (mail.folder !== "trash" && mail.folder !== "drafts" && (level === "high" || level === "medium")) {
        base.alerts += 1;
      }
    }
    return base;
  }, [state.mails, reports]);

  useEffect(() => {
    dispatch({ type: "agentConfigured", value: true });
  }, []);

  useEffect(() => {
    if (!selected) return;
    if (askedRef.current.has(selected.id)) return;
    askedRef.current.add(selected.id);
    const snapshot = selected;
    const staticReport = analyzeMail(snapshot);
    dispatch({ type: "agentStatus", id: snapshot.id, status: "loading" });
    void requestAgentReview(snapshot, staticReport)
      .then((response) => {
        if (!response.configured) {
          dispatch({ type: "agentConfigured", value: false });
          dispatch({
            type: "agentReport",
            report: { ...staticReport, agent: { status: "unconfigured" } },
          });
          return;
        }
        dispatch({ type: "agentConfigured", value: true });
        dispatch({ type: "agentReport", report: mergeAgent(staticReport, response) });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "El agente no pudo terminar.";
        dispatch({
          type: "agentReport",
          report: { ...staticReport, agent: { status: "error", error: message } },
        });
      });
  }, [selected]);

  const value: StoreValue = {
    state,
    reports,
    list,
    selected,
    report,
    unreadInbox: state.mails.filter((mail) => mail.folder === "inbox" && mail.unread).length,
    alertCount: counts.alerts,
    counts,
    select: (id) => dispatch({ type: "select", id }),
    setNav: (nav) => dispatch({ type: "nav", nav }),
    setQuery: (query) => dispatch({ type: "query", query }),
    setRisk: (riskFilter) => dispatch({ type: "risk", riskFilter }),
    toggleSecurity: (open) => dispatch({ type: "security", open }),
    openCompose: (draft) =>
      dispatch({
        type: "compose",
        draft: {
          to: draft?.to ?? "",
          subject: draft?.subject ?? "",
          body: draft?.body ?? "",
          mode: draft?.mode ?? "new",
          inReplyTo: draft?.inReplyTo,
        },
      }),
    closeCompose: () => dispatch({ type: "compose", draft: null }),
    sendCompose: async (draft) => {
      const mail = await adapterRef.current.send({
        to: draft.to || state.account.email,
        subject: draft.subject,
        body: draft.body,
        inReplyTo: draft.inReplyTo,
      }).catch(() => {
        const now = new Date().toISOString();
        const local: Mail = {
          id: `local-${Date.now().toString(36)}`,
          folder: "sent",
          starred: false,
          unread: false,
          date: now,
          from: state.account,
          to: [{ name: draft.to, email: draft.to }],
          subject: draft.subject || "(sin asunto)",
          preview: draft.body.slice(0, 140),
          bodyText: draft.body,
          bodyHtml: `<p>${draft.body.replace(/\n/g, "<br/>")}</p>`,
          attachments: [],
          auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
        };
        return local;
      });
      dispatch({ type: "sent", mail });
    },
    toggleStar: (id) => {
      const mail = state.mails.find((item) => item.id === id);
      if (mail) dispatch({ type: "patch", id, patch: { starred: !mail.starred } });
    },
    toggleRead: (id) => {
      const mail = state.mails.find((item) => item.id === id);
      if (mail) dispatch({ type: "patch", id, patch: { unread: !mail.unread } });
    },
    archive: (id) => {
      dispatch({ type: "patch", id, patch: { folder: "archive", unread: false } });
      dispatch({
        type: "toast",
        message: state.source === "gmail" ? "Archivado solo en esta vista." : "Archivado.",
      });
      if (state.selectedId === id) dispatch({ type: "select", id: null });
    },
    trash: (id) => {
      const mail = state.mails.find((item) => item.id === id);
      if (!mail) return;
      if (mail.folder === "trash") {
        dispatch({ type: "remove", id });
        return;
      }
      dispatch({ type: "patch", id, patch: { folder: "trash", unread: false } });
      dispatch({
        type: "toast",
        message: state.source === "gmail" ? "Quitado de esta vista. En Gmail no se borra." : "Movido a Papelera.",
      });
      if (state.selectedId === id) dispatch({ type: "select", id: null });
    },
    ackHigh: (id) => dispatch({ type: "ack", id }),
    askConfirm: (confirm) => dispatch({ type: "confirm", confirm }),
    closeConfirm: () => dispatch({ type: "confirm", confirm: null }),
    clearToast: () => dispatch({ type: "toast", message: null }),
    backToList: () => dispatch({ type: "mobile", pane: "list" }),
    openSettings: () => dispatch({ type: "settings", open: true }),
    closeSettings: () => dispatch({ type: "settings", open: false }),
    connectGmail: async () => {
      const clientId = await resolveGoogleClientId();
      if (!clientId) {
        dispatch({ type: "settings", open: true });
        dispatch({
          type: "mailboxError",
          message:
            "Google aún no tiene a Sello registrado. En cuanto esté el cliente, este botón abre el selector de cuentas.",
        });
        return;
      }
      dispatch({ type: "connecting", value: true });
      dispatch({ type: "mailboxError", message: null });
      try {
        const session = await requestGoogleSession(clientId);
        tokenRef.current = session.token;
        const profile = session.gmail ? await fetchGmailAccount(session.token) : await fetchGoogleProfile(session.token);
        askedRef.current = new Set();
        if (session.gmail) {
          dispatch({ type: "loadingMailbox", value: true });
          adapterRef.current = createGmailAdapter(() => tokenRef.current, profile);
          const mails = await adapterRef.current.list();
          dispatch({ type: "mailbox", mails, source: "gmail", account: profile });
          dispatch({ type: "toast", message: `Conectado a ${profile.email}. Solo lectura.` });
          return;
        }
        adapterRef.current = createMockAdapter();
        dispatch({
          type: "mailbox",
          mails: seedMails.map((mail) => ({ ...mail })),
          source: "google",
          account: profile,
        });
        dispatch({
          type: "toast",
          message: `Entraste como ${profile.email}. Google aún no deja leer Gmail a apps sin verificar; usas la bandeja de prueba.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo entrar con Google.";
        dispatch({ type: "mailboxError", message });
        dispatch({ type: "toast", message });
      }
    },
    disconnectGmail: () => {
      if (tokenRef.current) revokeGmailToken(tokenRef.current);
      tokenRef.current = "";
      adapterRef.current = createMockAdapter();
      askedRef.current = new Set();
      dispatch({
        type: "mailbox",
        mails: seedMails.map((mail) => ({ ...mail })),
        source: "mock",
        account: ME,
      });
      dispatch({ type: "toast", message: "Volviste a la bandeja de laboratorio." });
    },
    refreshAgentStatus: async () => {
      dispatch({ type: "agentConfigured", value: true });
    },
    importMail: (mail) => {
      askedRef.current.delete(mail.id);
      dispatch({ type: "addMail", mail });
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useMail(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useMail debe usarse dentro de MailProvider");
  return value;
}

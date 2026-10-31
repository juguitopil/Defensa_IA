import { ME } from "../format";
import { decodeB64UrlBinary, gmailToMail, pendingPdfAttachments, type GmailMessage } from "../gmail/parse";
import type { Address, Mail } from "../../types";
import type { MailAdapter } from "./types";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 401) {
    throw new Error("La sesión de Gmail caducó. Vuelve a conectar.");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail no respondió bien (${response.status}). ${text.slice(0, 180)}`);
  }
  return response.json() as Promise<T>;
}

async function listIds(token: string, label: string, max: number): Promise<string[]> {
  const data = await gmailFetch<{ messages?: { id: string }[] }>(
    token,
    `/messages?labelIds=${label}&maxResults=${max}`,
  );
  return data.messages?.map((item) => item.id) ?? [];
}

async function getMessage(token: string, id: string): Promise<Mail> {
  const raw = await gmailFetch<GmailMessage>(token, `/messages/${id}?format=full`);
  return gmailToMail(raw);
}

async function fillPdf(token: string, mail: Mail): Promise<Mail> {
  const pending = pendingPdfAttachments(mail);
  if (pending.length === 0) return mail;
  const filled = await Promise.all(
    pending.map(async (attachment) => {
      const data = await gmailFetch<{ data?: string }>(
        token,
        `/messages/${mail.id}/attachments/${attachment.id}`,
      );
      return {
        ...attachment,
        rawContent: data.data ? decodeB64UrlBinary(data.data) : undefined,
      };
    }),
  );
  const byId = new Map(filled.map((item) => [item.id, item]));
  return {
    ...mail,
    attachments: mail.attachments.map((item) => byId.get(item.id) ?? item),
  };
}

export async function fetchGmailAccount(token: string): Promise<Address> {
  const profile = await gmailFetch<{ emailAddress?: string }>(token, "/profile");
  const email = profile.emailAddress || ME.email;
  return { name: email.split("@")[0] ?? email, email };
}

export function createGmailAdapter(getToken: () => string, account: Address): MailAdapter {
  return {
    meta: {
      id: "gmail",
      label: `Gmail · ${account.email}`,
      status: "ready",
      note: "Solo lectura. El análisis no modifica tu cuenta.",
    },
    async list() {
      const token = getToken();
      const groups = await Promise.all([
        listIds(token, "INBOX", 40),
        listIds(token, "SENT", 12),
        listIds(token, "TRASH", 8),
      ]);
      const ids = [...new Set(groups.flat())];
      const mails: Mail[] = [];
      const queue = [...ids];
      const workers = 4;
      await Promise.all(
        Array.from({ length: workers }, async () => {
          while (queue.length) {
            const id = queue.shift();
            if (!id) break;
            const mail = await fillPdf(token, await getMessage(token, id));
            mails.push(mail);
          }
        }),
      );
      return mails;
    },
    async send() {
      throw new Error("Gmail está en solo lectura. El envío no sale de tu cuenta.");
    },
  };
}

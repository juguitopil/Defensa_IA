import {
  AlertTriangle,
  Archive,
  Inbox,
  PenLine,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import { useMail, type NavId } from "../store";
import { PumpkinMark } from "./PumpkinMark";

const ITEMS: { id: NavId; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Bandeja", icon: Inbox },
  { id: "alerts", label: "Alertas", icon: AlertTriangle },
  { id: "starred", label: "Destacados", icon: Star },
  { id: "sent", label: "Enviados", icon: Send },
  { id: "archive", label: "Archivo", icon: Archive },
  { id: "trash", label: "Papelera", icon: Trash2 },
];

export function Sidebar() {
  const { state, counts, unreadInbox, setNav, openCompose, openSettings } = useMail();

  return (
    <aside className="flex h-full w-[15.5rem] shrink-0 flex-col border-r border-line bg-sheet px-3 py-4">
      <div className="flex items-center gap-2.5 px-2">
        <PumpkinMark className="size-8 shrink-0" />
        <div>
          <p className="text-[1.05rem] font-semibold leading-none tracking-tight">Sello</p>
          <p className="mt-1 text-[0.72rem] text-muted">Correo con vigilancia</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => openCompose({ mode: "new" })}
        className="mt-5 flex h-10 items-center justify-center gap-2 rounded-xl bg-navy text-sm font-semibold text-sheet transition-colors hover:bg-navy-deep"
      >
        <PenLine className="size-4" />
        Redactar
      </button>

      <nav className="mt-4 flex flex-col gap-0.5" aria-label="Carpetas">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = state.nav === item.id;
          const count =
            item.id === "inbox" ? unreadInbox : item.id === "drafts" ? counts.drafts : counts[item.id];
          const show = item.id === "inbox" ? unreadInbox : item.id === "alerts" ? counts.alerts : count;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setNav(item.id)}
              className={`flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-left text-[0.92rem] transition-colors ${
                active
                  ? "bg-paper font-semibold text-ink"
                  : "text-muted hover:bg-paper/70 hover:text-ink"
              }`}
            >
              <Icon className="size-[1.05rem] shrink-0" strokeWidth={1.8} />
              <span className="flex-1">{item.label}</span>
              {show > 0 && (
                <span
                  className={`stamp min-w-6 rounded-full px-1.5 text-center text-[0.7rem] font-semibold ${
                    item.id === "alerts"
                      ? "bg-high-wash text-high"
                      : active
                        ? "bg-sheet text-ink"
                        : "bg-paper text-muted"
                  }`}
                >
                  {show}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl bg-paper px-3 py-3">
        <p className="text-[0.78rem] font-semibold text-ink">
          {state.source === "gmail" ? state.account.email : "Laboratorio"}
        </p>
        <p className="mt-1 text-[0.72rem] leading-snug text-muted">
          {state.source === "gmail"
            ? "Sesión de Google en solo lectura. El agente revisa el correo abierto."
            : "Bandeja de prueba. Entra con Google cuando quieras ver tu correo."}
        </p>
        <p className="mt-2 text-[0.7rem] font-semibold text-navy">Agente activo</p>
        <button
          type="button"
          onClick={openSettings}
          className="mt-2 text-[0.75rem] font-semibold text-navy hover:underline"
        >
          {state.source === "gmail" ? "Cuenta" : "Continuar con Google"}
        </button>
      </div>
    </aside>
  );
}

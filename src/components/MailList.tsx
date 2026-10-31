import { Search, ShieldAlert } from "lucide-react";
import { formatListDate, initials } from "../lib/format";
import { useMail, type NavId } from "../store";
import type { RiskFilter } from "../types";
import { TrustStamp } from "./TrustStamp";

const TITLES: Record<NavId, string> = {
  inbox: "Bandeja de entrada",
  alerts: "Alertas de seguridad",
  starred: "Destacados",
  sent: "Enviados",
  drafts: "Borradores",
  archive: "Archivo",
  trash: "Papelera",
};

const FILTERS: { id: RiskFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "high", label: "Alto" },
  { id: "medium", label: "Medio" },
  { id: "low", label: "Bajo" },
];

export function MailList() {
  const { state, list, reports, selected, setQuery, setRisk, select } = useMail();

  return (
    <section className="flex h-full w-[23.5rem] shrink-0 flex-col border-r border-line bg-sheet">
      <header className="border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.15rem] font-semibold tracking-tight">{TITLES[state.nav]}</h1>
            <p className="mt-0.5 text-[0.75rem] text-muted">
              {list.length === 0 ? "Nada que mostrar" : `${list.length} correos`}
            </p>
          </div>
        </div>
        <label className="mt-3 flex h-9 items-center gap-2 rounded-lg bg-paper px-2.5 text-muted">
          <Search className="size-4 shrink-0" />
          <input
            value={state.query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar en esta vista"
            className="h-full w-full bg-transparent text-[0.88rem] text-ink outline-none placeholder:text-faint"
          />
        </label>
        <div className="mt-2.5 flex gap-1" role="tablist" aria-label="Filtro de riesgo">
          {FILTERS.map((filter) => {
            const active = state.riskFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRisk(filter.id)}
                className={`h-7 rounded-full px-2.5 text-[0.72rem] font-semibold transition-colors ${
                  active ? "bg-ink text-sheet" : "bg-paper text-muted hover:text-ink"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShieldAlert className="mx-auto size-7 text-faint" />
            <p className="mt-3 text-[0.95rem] font-semibold">Esta vista está vacía</p>
            <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">
              {state.query
                ? "Ningún correo coincide con la búsqueda."
                : state.nav === "alerts"
                  ? "No hay correos de riesgo medio o alto en esta bandeja."
                  : "Cuando llegue algo, aparecerá aquí."}
            </p>
          </div>
        ) : (
          <ul>
            {list.map((mail) => {
              const report = reports[mail.id];
              const active = selected?.id === mail.id;
              return (
                <li key={mail.id} className="border-b border-line/80">
                  <button
                    type="button"
                    onClick={() => select(mail.id)}
                    className={`flex w-full gap-3 px-4 py-3.5 text-left transition-colors ${
                      active ? "bg-paper" : "hover:bg-paper/60"
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full text-[0.72rem] font-semibold ${
                        report.level === "high"
                          ? "bg-high-wash text-high"
                          : report.level === "medium"
                            ? "bg-mid-wash text-mid"
                            : "bg-paper text-navy"
                      }`}
                    >
                      {initials(mail.from.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span
                          className={`truncate text-[0.92rem] ${
                            mail.unread ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {mail.from.name}
                        </span>
                        <span className="stamp ml-auto shrink-0 text-[0.7rem] text-faint">
                          {formatListDate(mail.date)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        {mail.unread && (
                          <span className="size-1.5 shrink-0 rounded-full bg-navy" aria-label="No leído" />
                        )}
                        <span className={`truncate text-[0.84rem] ${mail.unread ? "text-ink" : "text-muted"}`}>
                          {mail.subject}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[0.76rem] text-faint">{mail.preview}</span>
                      <span className="mt-2 block">
                        <TrustStamp score={report.score} level={report.level} />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

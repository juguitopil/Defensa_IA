import {
  ChevronRight,
  FileWarning,
  Link2,
  Sparkles,
  Shield,
  UserRound,
} from "lucide-react";
import { riskLabel } from "../lib/format";
import { useMail } from "../store";
import type { RiskLevel } from "../types";
import { TrustStamp } from "./TrustStamp";

const TONE: Record<RiskLevel, string> = {
  low: "text-low",
  medium: "text-mid",
  high: "text-high",
};

export function SecurityPanel() {
  const { selected, report, state, toggleSecurity } = useMail();

  if (!state.securityOpen) {
    return (
      <button
        type="button"
        onClick={() => toggleSecurity(true)}
        className="hidden h-full w-11 shrink-0 flex-col items-center gap-3 border-l border-line bg-sheet pt-4 text-navy xl:flex"
        aria-label="Mostrar panel de seguridad"
      >
        <Shield className="size-4" />
        <span
          className="text-[0.68rem] font-semibold tracking-[0.14em] uppercase"
          style={{ writingMode: "vertical-rl" }}
        >
          Seguridad
        </span>
      </button>
    );
  }

  if (!selected || !report) {
    return (
      <aside className="hidden h-full w-[22rem] shrink-0 flex-col border-l border-line bg-sheet xl:flex">
        <PanelHead onHide={() => toggleSecurity(false)} />
        <p className="px-5 pt-8 text-[0.88rem] leading-relaxed text-muted">
          Abre un correo para ver el sello, el porqué de la nota y lo que conviene hacer.
        </p>
      </aside>
    );
  }

  const senderFindings = report.findings.filter(
    (item) => item.category === "sender" || item.category === "auth",
  );

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-line bg-sheet xl:w-[22rem]">
      <PanelHead onHide={() => toggleSecurity(false)} />
      <div className="app-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <div className="flex items-center gap-4 pt-2">
          <TrustStamp score={report.score} level={report.level} size="lg" />
          <div>
            <p className={`text-[0.95rem] font-semibold ${TONE[report.level]}`}>
              {riskLabel(report.level)}
            </p>
            <p className="mt-1 text-[0.78rem] leading-snug text-muted">{report.summary}</p>
          </div>
        </div>

        <Section title="Agente de IA" icon={Sparkles}>
          {report.agent.status === "loading" && (
            <p className="text-[0.78rem] text-muted">El agente está leyendo este correo…</p>
          )}
          {report.agent.status === "unconfigured" && (
            <p className="text-[0.78rem] leading-relaxed text-muted">
              El agente local está listo. Abre otro correo o espera un segundo.
            </p>
          )}
          {report.agent.status === "error" && (
            <p className="text-[0.78rem] leading-relaxed text-high">{report.agent.error}</p>
          )}
          {report.agent.status === "ready" && (
            <div className="space-y-2">
              {report.agent.verdict && (
                <p className="text-[0.8rem] leading-relaxed text-ink">{report.agent.verdict}</p>
              )}
              {report.agent.observations?.map((note) => (
                <p key={note} className="text-[0.75rem] leading-relaxed text-muted">
                  {note}
                </p>
              ))}
            </div>
          )}
          {report.agent.status === "idle" && (
            <p className="text-[0.78rem] text-muted">El agente aún no ha mirado este correo.</p>
          )}
        </Section>

        <Section title="Por qué esta nota">
          {report.findings.length === 0 ? (
            <p className="text-[0.8rem] leading-relaxed text-muted">
              Partimos de 100 y no hubo que restar nada: remitente, texto, enlaces y adjuntos están limpios.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {report.findings
                .slice()
                .sort((a, b) => b.points - a.points)
                .map((finding) => (
                  <li key={finding.id} className="rounded-xl bg-paper px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[0.82rem] font-semibold">{finding.title}</p>
                      {finding.points > 0 && (
                        <span className={`stamp text-[0.7rem] font-semibold ${TONE[finding.severity]}`}>
                          −{finding.points}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">{finding.detail}</p>
                  </li>
                ))}
            </ul>
          )}
        </Section>

        <Section title="Remitente" icon={UserRound}>
          <ul className="flex flex-col gap-1.5 text-[0.78rem] leading-relaxed text-muted">
            {report.senderNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
            {senderFindings.length === 0 && (
              <li>Nombre, dominio y autenticación encajan con un envío normal.</li>
            )}
          </ul>
        </Section>

        <Section title="Enlaces" icon={Link2}>
          {report.links.length === 0 ? (
            <p className="text-[0.78rem] text-muted">Este correo no trae enlaces.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.links.map((link) => (
                <li key={`${link.href}-${link.text}`} className="rounded-xl bg-paper px-3 py-2.5">
                  <p className={`text-[0.72rem] font-semibold ${TONE[link.suspicion]}`}>
                    {riskLabel(link.suspicion)}
                  </p>
                  <p className="mt-0.5 break-all text-[0.75rem] text-ink">{link.href}</p>
                  <p className="mt-1 text-[0.72rem] leading-relaxed text-muted">{link.reasons[0]}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Adjuntos" icon={FileWarning}>
          {report.attachments.length === 0 ? (
            <p className="text-[0.78rem] text-muted">No hay archivos adjuntos.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {report.attachments.map((item) => (
                <li key={item.attachmentId} className="rounded-xl bg-paper px-3 py-2.5">
                  <p className="text-[0.82rem] font-semibold">{item.name}</p>
                  {item.pdfIndicators.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-2">
                      {item.pdfIndicators.map((indicator) => (
                        <li key={indicator.id}>
                          <p className={`text-[0.72rem] font-semibold ${TONE[indicator.severity]}`}>
                            {indicator.label}
                          </p>
                          <p className="text-[0.72rem] leading-relaxed text-muted">{indicator.detail}</p>
                        </li>
                      ))}
                    </ul>
                  ) : item.findings.length > 0 ? (
                    <p className="mt-1 text-[0.75rem] leading-relaxed text-muted">
                      {item.findings[0].detail}
                    </p>
                  ) : (
                    <p className="mt-1 text-[0.75rem] text-muted">
                      Análisis estático sin indicadores de riesgo.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Qué te conviene hacer">
          <ul className="flex flex-col gap-2">
            {report.recommendations.map((item) => (
              <li key={item} className="flex gap-2 text-[0.78rem] leading-relaxed text-ink">
                <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-navy" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </aside>
  );
}

function PanelHead({ onHide }: { onHide: () => void }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-line px-4">
      <p className="text-[0.82rem] font-semibold">Seguridad</p>
      <button
        type="button"
        onClick={onHide}
        className="hidden text-[0.72rem] font-semibold text-navy hover:underline xl:inline"
      >
        Plegar
      </button>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Shield;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h3 className="flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-muted">
        {Icon && <Icon className="size-3.5" />}
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

import { PumpkinMark } from "../components/PumpkinMark";
import { riskLabel } from "../lib/format";
import type { Mail, RiskLevel, SecurityReport } from "../types";

const TONE: Record<RiskLevel, string> = {
  low: "t-low",
  medium: "t-mid",
  high: "t-high",
};

const WASH: Record<RiskLevel, string> = {
  low: "low",
  medium: "mid",
  high: "high",
};

interface Props {
  open: boolean;
  onToggle: () => void;
  mail: Mail | null;
  report: SecurityReport | null;
  embedded?: boolean;
}

export function ExtensionPanel({ open, onToggle, mail, report, embedded }: Props) {
  if (!open) {
    return (
      <button type="button" className="tab" onClick={onToggle} aria-label="Mostrar Sello">
        <PumpkinMark className="size-8" />
        <strong>Sello</strong>
        <span>{report ? report.score : "—"}</span>
        <em>Mostrar</em>
      </button>
    );
  }

  return (
    <aside className={embedded ? "panel embedded" : "panel"} role="complementary" aria-label="Sello de seguridad">
      <div className="head">
        <p>Sello</p>
        <button type="button" onClick={onToggle}>
          Ocultar
        </button>
      </div>
      {mail && report && (
        <div className="score">
          <div className={`stamp ${WASH[report.level]}`} aria-label={`${riskLabel(report.level)}, ${report.score} de 100`}>
            <span>{report.score}</span>
            <span>/100</span>
          </div>
          <div>
            <h2 className={TONE[report.level]}>{riskLabel(report.level)}</h2>
            <p>{report.summary}</p>
          </div>
        </div>
      )}
      {mail && report?.level === "high" && (
        <div className="banner">Alto riesgo. Puedes leerlo; no pulses enlaces ni abras adjuntos si no lo esperabas.</div>
      )}
      <div className="scroll">
        {!mail || !report ? (
          <div className="empty">
            <p className="muted">Abre un correo en Gmail. Sello lee el mensaje visible y pone la nota aquí. Sirve con tu cuenta y con cualquier otra.</p>
          </div>
        ) : (
          <>

            <section className="section">
              <h3>Agente</h3>
              {report.agent.verdict && <p className="muted">{report.agent.verdict}</p>}
              {report.agent.observations?.map((note) => (
                <p key={note} className="muted">
                  {note}
                </p>
              ))}
            </section>

            <section className="section">
              <h3>Por qué esta nota</h3>
              {report.findings.length === 0 ? (
                <p className="muted">Partimos de 100. Remitente, texto, enlaces y adjuntos no pidieron restar.</p>
              ) : (
                report.findings
                  .slice()
                  .sort((a, b) => b.points - a.points)
                  .map((finding) => (
                    <div key={finding.id} className="card">
                      <div className="row">
                        <strong>{finding.title}</strong>
                        {finding.points > 0 && <span className={`points ${TONE[finding.severity]}`}>−{finding.points}</span>}
                      </div>
                      <p>{finding.detail}</p>
                    </div>
                  ))
              )}
            </section>

            <section className="section">
              <h3>Remitente</h3>
              <p className="muted">
                {mail.from.name} · {mail.from.email}
              </p>
              {report.senderNotes.map((note) => (
                <p key={note} className="muted">
                  {note}
                </p>
              ))}
            </section>

            <section className="section">
              <h3>Enlaces</h3>
              {report.links.length === 0 ? (
                <p className="muted">Este correo no trae enlaces.</p>
              ) : (
                report.links.map((link) => (
                  <div key={`${link.href}-${link.text}`} className="card">
                    <strong className={TONE[link.suspicion]}>{riskLabel(link.suspicion)}</strong>
                    <p className="break">{link.href}</p>
                    <p>{link.reasons[0]}</p>
                  </div>
                ))
              )}
            </section>

            <section className="section">
              <h3>Adjuntos</h3>
              {report.attachments.length === 0 ? (
                <p className="muted">No hay archivos adjuntos.</p>
              ) : (
                report.attachments.map((item) => (
                  <div key={item.attachmentId} className="card">
                    <strong>{item.name}</strong>
                    {item.pdfIndicators.length > 0 ? (
                      item.pdfIndicators.map((indicator) => (
                        <p key={indicator.id}>
                          <span className={TONE[indicator.severity]}>{indicator.label}. </span>
                          {indicator.detail}
                        </p>
                      ))
                    ) : (
                      <p>Análisis estático sin indicadores de riesgo. El archivo no se ha ejecutado.</p>
                    )}
                  </div>
                ))
              )}
            </section>

            <section className="section">
              <h3>Qué te conviene hacer</h3>
              {report.recommendations.map((item) => (
                <p key={item} className="rec">
                  {item}
                </p>
              ))}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

import type { Mail, SecurityReport } from "../../types";

export function buildLocalAgent(mail: Mail, report: SecurityReport) {
  const top = [...report.findings].sort((a, b) => b.points - a.points);
  const observations: string[] = [];

  if (report.senderNotes[0]) observations.push(report.senderNotes[0]);
  for (const finding of top.slice(0, 3)) {
    observations.push(finding.detail);
  }
  if (report.links.some((link) => link.suspicion === "high")) {
    const link = report.links.find((item) => item.suspicion === "high");
    if (link) observations.push(`El enlace visible no se fía: ${link.href}`);
  }
  if (report.attachments.some((item) => item.pdfIndicators.length > 0)) {
    const pdf = report.attachments.find((item) => item.pdfIndicators.length > 0);
    if (pdf) {
      observations.push(
        `En ${pdf.name} el análisis estático vio: ${pdf.pdfIndicators.map((item) => item.label.toLowerCase()).join(", ")}. No se ha ejecutado.`,
      );
    }
  }
  if (observations.length === 0) {
    observations.push(
      `Remitente ${mail.from.email}. Asunto «${mail.subject}». No aparecen señales raras en el texto, los enlaces ni los adjuntos.`,
    );
  }

  const verdict =
    report.level === "high"
      ? `Alto riesgo (${report.score}/100). El agente no abre enlaces ni archivos. Si no esperabas este correo, déjalo.`
      : report.level === "medium"
        ? `Riesgo medio (${report.score}/100). Se puede leer, pero conviene mirar el destino de los enlaces antes de pulsar.`
        : `Bajo riesgo (${report.score}/100). Se ve un correo normal. Igual no descargues adjuntos que no pediste.`;

  return {
    configured: true,
    summary: report.summary,
    verdict,
    observations: observations.slice(0, 5),
    recommendations: report.recommendations,
    extraFindings: [],
  };
}

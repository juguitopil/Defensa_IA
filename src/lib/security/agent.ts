import type { AgentReview, Finding, Mail, SecurityReport } from "../../types";
import { loadLocalAiKey } from "../settings";
import { buildLocalAgent } from "./local-agent";

export interface AgentResponse {
  configured: boolean;
  summary?: string;
  verdict?: string;
  observations?: string[];
  recommendations?: string[];
  extraFindings?: Finding[];
  error?: string;
}

export async function fetchAgentStatus(): Promise<{ configured: boolean; model?: string }> {
  return { configured: true, model: "sello-local" };
}

export async function requestAgentReview(mail: Mail, report: SecurityReport): Promise<AgentResponse> {
  const local = buildLocalAgent(mail, report);
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: loadLocalAiKey() || undefined,
        mail: {
          from: mail.from,
          to: mail.to,
          replyTo: mail.replyTo,
          subject: mail.subject,
          date: mail.date,
          bodyText: mail.bodyText.slice(0, 5000),
          auth: mail.auth,
        },
        report: {
          score: report.score,
          level: report.level,
          summary: report.summary,
          findings: report.findings.map((item) => ({
            title: item.title,
            detail: item.detail,
            points: item.points,
            severity: item.severity,
          })),
          links: report.links,
          attachments: report.attachments.map((item) => ({
            name: item.name,
            indicators: item.pdfIndicators,
            findings: item.findings.map((finding) => finding.title),
          })),
          senderNotes: report.senderNotes,
        },
      }),
    });
    if (!response.ok) return local;
    const remote = (await response.json()) as AgentResponse;
    if (remote.configured && !remote.error) return remote;
  } catch {
    /* el agente local cubre la prueba */
  }
  return local;
}

export function mergeAgent(report: SecurityReport, agent: AgentResponse): SecurityReport {
  if (!agent.configured) {
    return { ...report, agent: { status: "unconfigured" } };
  }

  const extras = (agent.extraFindings ?? []).filter((item) => item.title && item.detail);
  const findings = extras.length ? [...report.findings, ...extras] : report.findings;
  const deducted = findings.reduce((sum, item) => sum + (item.points || 0), 0);
  const score = Math.max(0, Math.min(100, extras.length ? 100 - deducted : report.score));
  const level = score >= 75 ? "low" : score >= 45 ? "medium" : "high";

  const review: AgentReview = {
    status: "ready",
    verdict: agent.verdict,
    observations: agent.observations?.filter(Boolean),
  };

  return {
    ...report,
    findings,
    score,
    level,
    summary: agent.summary || report.summary,
    recommendations: agent.recommendations?.length ? agent.recommendations : report.recommendations,
    agent: review,
  };
}

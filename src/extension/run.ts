import { analyzeMail } from "../lib/security/analyze";
import { buildLocalAgent } from "../lib/security/local-agent";
import { mergeAgent } from "../lib/security/agent";
import type { Mail, SecurityReport } from "../types";
import { fillPdfAttachments, scrapeOpenMail } from "./gmail";

export async function inspectDocument(root: ParentNode = document): Promise<{
  mail: Mail;
  report: SecurityReport;
} | null> {
  const scraped = scrapeOpenMail(root);
  if (!scraped) return null;
  const mail = await fillPdfAttachments(scraped);
  const base = analyzeMail(mail);
  const report = mergeAgent(base, buildLocalAgent(mail, base));
  return { mail, report };
}

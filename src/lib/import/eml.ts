import type { Mail } from "../../types";
import { sanitizeHtml } from "../sanitize";

function header(raw: string, name: string): string {
  const re = new RegExp(`^${name}:\\s*(.*(?:\\r?\\n[ \\t].*)*)`, "im");
  const match = raw.match(re);
  if (!match) return "";
  return match[1].replace(/\r?\n[ \t]+/g, " ").trim();
}

function parseAddr(value: string): { name: string; email: string } {
  const angled = value.match(/^(?:"([^"]+)"|([^<]*?))\s*<([^>]+)>$/);
  if (angled) return { name: (angled[1] || angled[2] || angled[3]).trim(), email: angled[3].trim() };
  if (value.includes("@")) return { name: value.split("@")[0] ?? value, email: value.trim() };
  return { name: value, email: value };
}

export function parseEml(source: string): Mail {
  const split = source.split(/\r?\n\r?\n/);
  const head = split[0] ?? "";
  const body = split.slice(1).join("\n\n");
  const from = parseAddr(header(head, "From") || "desconocido@local");
  const to = header(head, "To")
    .split(",")
    .map((part) => parseAddr(part.trim()))
    .filter((item) => item.email);
  const subject = header(head, "Subject") || "(sin asunto)";
  const dateHeader = header(head, "Date");
  const date = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
  const htmlMatch = body.match(/<html[\s\S]*<\/html>/i);
  const bodyHtml = htmlMatch
    ? sanitizeHtml(htmlMatch[0])
    : `<p>${body.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`;
  const bodyText = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return {
    id: `import-${Date.now().toString(36)}`,
    folder: "inbox",
    starred: false,
    unread: true,
    date,
    from,
    to: to.length ? to : [{ name: "tú", email: "alex@sello.mail" }],
    subject,
    preview: bodyText.slice(0, 160),
    bodyText,
    bodyHtml,
    attachments: [],
    auth: { spf: "none", dkim: "none", dmarc: "none" },
  };
}

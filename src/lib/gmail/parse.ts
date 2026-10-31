import type { Address, Attachment, AuthResult, FolderId, Mail, MailAuth } from "../../types";
import { sanitizeHtml } from "../sanitize";

export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

export interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
}

export function decodeB64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(pad);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return binary;
  }
}

export function decodeB64UrlBinary(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(pad);
}

export function parseAddress(raw: string): Address {
  const trimmed = raw.trim().replace(/;$/, "");
  const angled = trimmed.match(/^(?:"([^"]+)"|([^<]*?))\s*<([^>]+)>$/);
  if (angled) {
    const name = (angled[1] || angled[2] || "").trim();
    return { name: name || angled[3], email: angled[3].trim() };
  }
  if (trimmed.includes("@")) {
    return { name: trimmed.split("@")[0] ?? trimmed, email: trimmed };
  }
  return { name: trimmed, email: trimmed };
}

export function parseAddressList(raw?: string): Address[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => parseAddress(part))
    .filter((item) => item.email);
}

function header(part: GmailPart | undefined, name: string): string {
  const needle = name.toLowerCase();
  return part?.headers?.find((item) => item.name.toLowerCase() === needle)?.value ?? "";
}

function walk(part: GmailPart | undefined, visit: (item: GmailPart) => void): void {
  if (!part) return;
  visit(part);
  part.parts?.forEach((child) => walk(child, visit));
}

function kindOf(name: string, mime: string): Attachment["kind"] {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime === "text/html" || lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (/\.(exe|bat|cmd|scr|js|vbs|ps1|msi)$/i.test(lower)) return "exec";
  if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(lower)) return "doc";
  return "other";
}

function parseAuth(raw: string): MailAuth {
  const lower = raw.toLowerCase();
  const pick = (key: string): AuthResult => {
    if (new RegExp(`${key}=pass`).test(lower)) return "pass";
    if (new RegExp(`${key}=fail`).test(lower)) return "fail";
    return "none";
  };
  return { spf: pick("spf"), dkim: pick("dkim"), dmarc: pick("dmarc") };
}

function folderFrom(labels: string[]): { folder: FolderId; starred: boolean } {
  const set = new Set(labels);
  const starred = set.has("STARRED");
  if (set.has("TRASH")) return { folder: "trash", starred };
  if (set.has("DRAFT")) return { folder: "drafts", starred };
  if (set.has("SENT") && !set.has("INBOX")) return { folder: "sent", starred };
  if (set.has("INBOX")) return { folder: "inbox", starred };
  return { folder: "archive", starred };
}

export function gmailToMail(message: GmailMessage): Mail {
  const labels = message.labelIds ?? [];
  const { folder, starred } = folderFrom(labels);
  const root = message.payload;
  let bodyText = "";
  let bodyHtml = "";
  const attachments: Attachment[] = [];

  walk(root, (part) => {
    const mime = part.mimeType ?? "";
    const filename = part.filename ?? "";
    if (filename && (part.body?.attachmentId || part.body?.data)) {
      attachments.push({
        id: part.body?.attachmentId || `${message.id}-${filename}`,
        name: filename,
        mime,
        size: part.body?.size ?? 0,
        kind: kindOf(filename, mime),
        rawContent: part.body?.data ? decodeB64UrlBinary(part.body.data) : undefined,
      });
      return;
    }
    if (part.body?.data && mime === "text/plain" && !bodyText) {
      bodyText = decodeB64Url(part.body.data);
    }
    if (part.body?.data && mime === "text/html" && !bodyHtml) {
      bodyHtml = sanitizeHtml(decodeB64Url(part.body.data));
    }
  });

  if (!bodyText && bodyHtml) {
    bodyText = bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (!bodyHtml && bodyText) {
    bodyHtml = `<p>${bodyText.replace(/\n/g, "<br/>")}</p>`;
  }

  const from = parseAddress(header(root, "From") || "desconocido@local");
  const authHeader = header(root, "Authentication-Results");

  return {
    id: message.id,
    folder,
    starred,
    unread: labels.includes("UNREAD"),
    date: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : header(root, "Date") || new Date().toISOString(),
    from,
    to: parseAddressList(header(root, "To")),
    cc: parseAddressList(header(root, "Cc")),
    replyTo: header(root, "Reply-To") ? parseAddress(header(root, "Reply-To")) : undefined,
    subject: header(root, "Subject") || "(sin asunto)",
    preview: (message.snippet || bodyText).slice(0, 160),
    bodyText,
    bodyHtml,
    attachments,
    auth: parseAuth(authHeader),
  };
}

export function pendingPdfAttachments(mail: Mail): Attachment[] {
  return mail.attachments.filter(
    (item) => item.kind === "pdf" && !item.rawContent && item.size < 2_500_000,
  );
}

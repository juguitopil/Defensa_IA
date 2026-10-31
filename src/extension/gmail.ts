import type { Address, Attachment, Mail } from "../types";

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;

function textOf(el: Element | null | undefined): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function attr(el: Element | null | undefined, name: string): string {
  return el?.getAttribute(name)?.trim() || "";
}

function first(root: ParentNode, selectors: string[]): Element | null {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function parseAddress(el: Element | null | undefined): Address | null {
  if (!el) return null;
  const hover = attr(el, "data-hovercard-id").replace(/^mailto:/i, "");
  const email = (attr(el, "email") || hover || textOf(el).match(EMAIL_RE)?.[0] || "").toLowerCase();
  if (!email || !email.includes("@")) return null;
  const name =
    attr(el, "name") ||
    attr(el, "data-name") ||
    textOf(el).replace(EMAIL_RE, "").replace(/[<>]/g, "").trim() ||
    email.split("@")[0] ||
    "Remitente";
  return { name, email };
}

function addressFromText(value: string): Address | null {
  const email = value.match(EMAIL_RE)?.[0]?.toLowerCase();
  if (!email) return null;
  const name = value.replace(EMAIL_RE, "").replace(/[<>]/g, "").trim() || email.split("@")[0] || "Remitente";
  return { name, email };
}

function parseDownload(raw: string): { name: string; mime: string; url: string; size: number } | null {
  if (!raw) return null;
  if (raw.startsWith("http")) {
    return { name: "adjunto", mime: "application/octet-stream", url: raw, size: 0 };
  }
  const parts = raw.split(":");
  if (parts.length >= 4 && parts[parts.length - 1]?.startsWith("http")) {
    return {
      mime: parts[1] || "application/octet-stream",
      name: parts[2] || "adjunto",
      url: parts.slice(3).join(":"),
      size: Number(parts[0].replace(/\D/g, "")) || 0,
    };
  }
  const http = raw.match(/https?:\/\/\S+/)?.[0];
  if (!http) return null;
  return { name: "adjunto", mime: "application/octet-stream", url: http, size: 0 };
}

function kindOf(name: string, mime: string): Attachment["kind"] {
  const lower = `${name} ${mime}`.toLowerCase();
  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("image") || /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) return "image";
  if (/\.(html?|xhtml)$/i.test(name) || lower.includes("text/html")) return "html";
  if (/\.(exe|bat|cmd|msi|scr|js|vbs|ps1|dll)$/i.test(name)) return "exec";
  if (/\.(docx?|xlsx?|pptx?|odt|rtf)$/i.test(name)) return "doc";
  return "other";
}

function conversationRoot(root: ParentNode): Element | null {
  if (root instanceof Element && (root.classList.contains("if") || root.getAttribute("role") === "main")) {
    return root;
  }
  return (
    first(root, [
      "div.nH.if",
      "div.aeJ",
      "[role='main'] .nH.if",
      "[role='main']",
      ".AO",
    ]) || (root instanceof Element ? root : document.body)
  );
}

function isOpenMessage(el: Element | null): boolean {
  if (!el) return false;
  const box = el.getBoundingClientRect();
  return box.width > 160 && box.height > 80;
}

function isReading(root: ParentNode): boolean {
  const subject = first(root, ["h2.hP", "h1.hP", "h2[data-legacy-thread-id]", ".ha h2"]);
  const body = first(root, ["div.ii.gt .a3s", "div.a3s.aiL", "div.ii.gt", "[data-message-id] .a3s"]);
  if (isOpenMessage(subject) || isOpenMessage(body)) return true;
  return false;
}

function messageNodes(root: Element): HTMLElement[] {
  const nodes = [
    ...root.querySelectorAll<HTMLElement>(
      "div[data-message-id], div[data-legacy-message-id], div.adn.ads, div.gs",
    ),
  ];
  return nodes.filter((node, index, all) => {
    if (node.getClientRects().length === 0) return false;
    return !all.some((other, otherIndex) => otherIndex !== index && other.contains(node));
  });
}

function scrapeAttachments(scope: Element): Attachment[] {
  const found: Attachment[] = [];
  const seen = new Set<string>();
  scope
    .querySelectorAll("[download_url], a.aZo, span.aZo, div.aQH a, span.aV3, span.aYY, .aQy")
    .forEach((chip, index) => {
      const parsed = parseDownload(attr(chip, "download_url"));
      const name = parsed?.name && parsed.name !== "adjunto" ? parsed.name : textOf(chip) || attr(chip, "aria-label");
      if (!name) return;
      const key = `${name}|${parsed?.url || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      const mime = parsed?.mime || (/\.pdf$/i.test(name) ? "application/pdf" : "application/octet-stream");
      found.push({
        id: parsed?.url || `att-${index}-${name}`,
        name,
        mime,
        size: parsed?.size || 0,
        kind: kindOf(name, mime),
      });
    });
  return found;
}

function bodyHtmlOf(scope: Element): { html: string; text: string } {
  const bodies = [...scope.querySelectorAll<HTMLElement>(".a3s.aiL, div.ii.gt div.a3s, div.ii.gt, [data-message-id] .a3s")];
  const body = bodies.at(-1);
  const html = body?.innerHTML || scope.innerHTML || "";
  const text = textOf(body) || textOf(scope);
  return { html, text };
}

function subjectOf(root: ParentNode): string {
  const direct = textOf(
    first(root, [
      "h2.hP",
      "h1.hP",
      "h2[data-legacy-thread-id]",
      ".ha h2",
      "[data-thread-perm-id] h2",
      "h2[tabindex='-1']",
    ]),
  );
  if (direct) return direct;
  const title = document.title.replace(/\s+-\s+Gmail\s*$/i, "");
  const parts = title.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && EMAIL_RE.test(parts[parts.length - 1] || "")) {
    return parts.slice(0, -1).filter((part) => !/^(bandeja|inbox|enviados|sent|destacados|starred)$/i.test(part)).join(" - ");
  }
  return parts[0] && parts[0] !== "Gmail" ? parts[0] : "";
}

function fromOf(scope: Element, convo: Element): Address | null {
  const nodes = [
    ...scope.querySelectorAll("span.gD[email], span[email], [data-hovercard-id*='@'], span.gD, a[href^='mailto:']"),
    ...convo.querySelectorAll("span.gD[email], span[email], [data-hovercard-id*='@'], a[href^='mailto:']"),
  ];
  for (const node of nodes) {
    const parsed = parseAddress(node) || addressFromText(attr(node, "href") || textOf(node));
    if (parsed) return parsed;
  }
  return (
    addressFromText(textOf(scope.querySelector(".gE, .go, .cf, .gD"))) ||
    addressFromText(textOf(scope)) ||
    addressFromText(textOf(convo))
  );
}

export function scrapeOpenMail(root: ParentNode = document): Mail | null {
  if (!isReading(root)) return null;
  const convo = conversationRoot(root);
  if (!convo) return null;

  const messages = messageNodes(convo);
  const current = messages.at(-1) || (first(convo, ["div.ii.gt", "div.a3s"]) as HTMLElement | null);
  const scope = current || (convo as HTMLElement);
  const from = fromOf(scope, convo);
  const subject = subjectOf(convo);
  const { html, text } = bodyHtmlOf(scope);
  if (!from && !subject && !text) return null;
  const sender = from || addressFromText(text) || addressFromText(document.title);
  if (!sender) return null;

  const to = [...scope.querySelectorAll("span.g2[email], span.g2")]
    .map((el) => parseAddress(el))
    .filter((item): item is Address => Boolean(item));
  const replyTo = parseAddress(scope.querySelector(".ajC [email], .gI [email]"));
  const dateTitle = attr(scope.querySelector("span.g3"), "title") || textOf(scope.querySelector("span.g3"));
  const parsedDate = dateTitle ? Date.parse(dateTitle) : Number.NaN;

  return {
    id:
      attr(scope, "data-legacy-message-id") ||
      attr(scope, "data-message-id") ||
      `${sender.email}|${subject}|${text.slice(0, 80)}`,
    folder: "inbox",
    starred: Boolean(convo.querySelector("[aria-label='Destacado'], [aria-pressed='true']")),
    unread: false,
    date: Number.isNaN(parsedDate) ? new Date().toISOString() : new Date(parsedDate).toISOString(),
    from: sender,
    to: to.length ? to : [{ name: "yo", email: "me@gmail.com" }],
    replyTo: replyTo && replyTo.email !== sender.email ? replyTo : undefined,
    subject: subject || "(sin asunto)",
    preview: text.slice(0, 140),
    bodyText: text,
    bodyHtml: html,
    attachments: scrapeAttachments(scope).length ? scrapeAttachments(scope) : scrapeAttachments(convo),
    auth: { spf: "none", dkim: "none", dmarc: "none" },
  };
}

function toBinary(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let out = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return out;
}

export async function fillPdfAttachments(mail: Mail): Promise<Mail> {
  if (location.hostname !== "mail.google.com") return mail;
  const pending = mail.attachments.filter((item) => item.kind === "pdf" && item.id.startsWith("http"));
  if (pending.length === 0) return mail;
  const filled = await Promise.all(
    pending.map(async (item) => {
      try {
        const response = await fetch(item.id, { credentials: "include" });
        if (!response.ok) return item;
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 2_500_000) return item;
        return { ...item, rawContent: toBinary(buffer), size: buffer.byteLength };
      } catch {
        return item;
      }
    }),
  );
  const byId = new Map(filled.map((item) => [item.id, item]));
  return {
    ...mail,
    attachments: mail.attachments.map((item) => byId.get(item.id) ?? item),
  };
}

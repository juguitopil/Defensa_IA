import type {
  AnalyzedLink,
  AttachmentReport,
  Finding,
  Mail,
  RiskLevel,
  SecurityReport,
} from "../../types";
import { domainOf } from "../format";
import { analyzePdfStatic, isPdfName } from "./pdf";

const KNOWN_BRANDS: { name: string; domains: string[] }[] = [
  { name: "paypal", domains: ["paypal.com", "paypal.es"] },
  { name: "microsoft", domains: ["microsoft.com", "office.com", "outlook.com", "live.com"] },
  { name: "google", domains: ["google.com", "gmail.com", "googlemail.com"] },
  { name: "apple", domains: ["apple.com", "icloud.com"] },
  { name: "amazon", domains: ["amazon.com", "amazon.es"] },
  { name: "dhl", domains: ["dhl.com", "dhl.es"] },
  { name: "fedex", domains: ["fedex.com"] },
  { name: "ups", domains: ["ups.com"] },
  { name: "correos", domains: ["correos.es"] },
  { name: "bbva", domains: ["bbva.es", "bbva.com"] },
  { name: "santander", domains: ["santander.es", "santander.com"] },
  { name: "caixabank", domains: ["caixabank.es"] },
  { name: "hacienda", domains: ["hacienda.gob.es", "agenciatributaria.gob.es"] },
  { name: "adobe", domains: ["adobe.com"] },
  { name: "dropbox", domains: ["dropbox.com"] },
];

const SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "cutt.ly",
  "rebrand.ly",
  "lnkd.in",
  "is.gd",
  "rb.gy",
];

const TRUSTED_WORK = ["sello.mail", "northline.es"];

function levelFromScore(score: number): RiskLevel {
  if (score >= 75) return "low";
  if (score >= 45) return "medium";
  return "high";
}

function brandHit(text: string): (typeof KNOWN_BRANDS)[number] | undefined {
  const lower = text.toLowerCase();
  return KNOWN_BRANDS.find((brand) => lower.includes(brand.name));
}

function looksLike(domain: string, target: string): boolean {
  if (domain === target) return false;
  if (domain.includes(target.replace(".", "-"))) return true;
  if (domain.replace(/0/g, "o").replace(/1/g, "l") === target) return true;
  const compact = (value: string) => value.replace(/[-.]/g, "");
  if (compact(domain).includes(compact(target)) && domain !== target) return true;
  const swaps: Record<string, string> = {
    rnicrosoft: "microsoft",
    paypa1: "paypal",
    amaz0n: "amazon",
    microsft: "microsoft",
    g00gle: "google",
  };
  const head = domain.split(".")[0] ?? "";
  return swaps[head] === target.split(".")[0];
}

function parseUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

export function extractLinks(html: string, text: string): AnalyzedLink[] {
  const seen = new Map<string, AnalyzedLink>();
  const knownHrefs = new Set<string>();
  const knownLabels = new Set<string>();

  const tag = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis;
  for (const match of html.matchAll(tag)) {
    const href = match[1].trim();
    const label = match[2].replace(/<[^>]+>/g, "").trim() || href;
    knownHrefs.add(href);
    knownLabels.add(label);
    seen.set(`${href}|${label}`, analyzeLink(href, label));
  }

  const bare = text.match(/https?:\/\/[^\s)\]>'"]+/gi) ?? [];
  for (const href of bare) {
    if (knownHrefs.has(href) || knownLabels.has(href)) continue;
    const key = `${href}|${href}`;
    if (![...seen.keys()].some((item) => item.startsWith(`${href}|`))) {
      seen.set(key, analyzeLink(href, href));
    }
  }

  return [...seen.values()];
}

function analyzeLink(href: string, text: string): AnalyzedLink {
  const reasons: string[] = [];
  let suspicion: RiskLevel = "low";
  const url = parseUrl(href);

  if (!url) {
    return {
      href,
      text,
      suspicion: "medium",
      reasons: ["La dirección no se pudo interpretar como una URL válida."],
    };
  }

  const host = url.hostname.toLowerCase();

  if (url.protocol === "data:" || url.protocol === "file:") {
    reasons.push("Usa un esquema inusual (data o file), no una web normal.");
    suspicion = "high";
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    reasons.push("El destino es una dirección IP, no un nombre de empresa.");
    suspicion = "high";
  }

  if (url.protocol === "http:") {
    reasons.push("Va por http, sin cifrado.");
    suspicion = bump(suspicion, "medium");
  }

  if (host.startsWith("xn--")) {
    reasons.push("El dominio está en punycode: puede imitar otra marca con caracteres parecidos.");
    suspicion = "high";
  }

  if (SHORTENERS.some((item) => host === item || host.endsWith(`.${item}`))) {
    reasons.push("Es un acortador: no se ve el destino real hasta pulsar.");
    suspicion = bump(suspicion, "high");
  }

  for (const brand of KNOWN_BRANDS) {
    if (looksLike(host, brand.domains[0]) || brand.name && looksLike(host, `${brand.name}.com`)) {
      if (!brand.domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
        reasons.push(`El dominio se parece a ${brand.domains[0]}, pero no es ese sitio.`);
        suspicion = "high";
      }
    }
  }

  const textUrl = parseUrl(text.startsWith("http") ? text : "");
  if (textUrl && textUrl.hostname.toLowerCase() !== host) {
    reasons.push(`El texto muestra ${textUrl.hostname}, pero el enlace va a ${host}.`);
    suspicion = "high";
  } else if (text && /https?:\/\//i.test(text) === false) {
    const brand = brandHit(text);
    if (brand && !brand.domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      reasons.push(`El texto habla de ${brand.name}, pero el enlace no apunta a su dominio oficial.`);
      suspicion = bump(suspicion, "medium");
    }
  }

  if (reasons.length === 0) {
    reasons.push("El enlace no muestra señales raras por sí solo.");
  }

  return { href, text, suspicion, reasons };
}

function bump(current: RiskLevel, next: RiskLevel): RiskLevel {
  const rank = { low: 0, medium: 1, high: 2 };
  return rank[next] > rank[current] ? next : current;
}

function push(
  findings: Finding[],
  finding: Finding,
) {
  findings.push(finding);
}

function analyzeSender(mail: Mail, findings: Finding[], notes: string[]): void {
  const fromDomain = domainOf(mail.from.email);
  const brand = brandHit(mail.from.name) ?? brandHit(mail.from.email.split("@")[0] ?? "");

  if (brand && !brand.domains.some((domain) => fromDomain === domain || fromDomain.endsWith(`.${domain}`))) {
    push(findings, {
      id: "brand-spoof",
      category: "sender",
      severity: "high",
      title: "El nombre no coincide con el dominio",
      detail: `Se presenta como ${mail.from.name}, pero el correo sale de ${fromDomain}, no de ${brand.domains[0]}.`,
      points: 22,
    });
    notes.push(`La marca ${brand.name} no envía desde ${fromDomain}.`);
  } else {
    notes.push(`Remitente declarado: ${mail.from.name} · ${mail.from.email}`);
  }

  if (mail.replyTo) {
    const replyDomain = domainOf(mail.replyTo.email);
    if (replyDomain && replyDomain !== fromDomain) {
      push(findings, {
        id: "reply-to-mismatch",
        category: "sender",
        severity: "high",
        title: "Responder iría a otro dominio",
        detail: `El mensaje sale de ${fromDomain}, pero la respuesta se enviaría a ${mail.replyTo.email}.`,
        points: 16,
      });
    }
  }

  for (const known of KNOWN_BRANDS) {
    if (looksLike(fromDomain, known.domains[0])) {
      push(findings, {
        id: "lookalike-domain",
        category: "sender",
        severity: "high",
        title: "Dominio que imita a una marca",
        detail: `${fromDomain} se parece a ${known.domains[0]}, pero no es el sitio oficial.`,
        points: 26,
      });
      break;
    }
  }

  const local = mail.from.email.split("@")[0]?.toLowerCase() ?? "";
  const nameToken = mail.from.name.toLowerCase().replace(/[^a-záéíóúñ]+/g, "");
  if (
    nameToken.length > 3 &&
    local.length > 3 &&
    !nameToken.includes(local.slice(0, 4)) &&
    !local.includes(nameToken.slice(0, 4)) &&
    !brand
  ) {
    push(findings, {
      id: "name-email-mismatch",
      category: "sender",
      severity: "medium",
      title: "Nombre y cuenta no se parecen",
      detail: `El nombre visible es «${mail.from.name}», pero la cuenta es ${mail.from.email}. Puede ser un alias; también se usa para hacerse pasar por otra persona.`,
      points: 8,
    });
  }

  if (TRUSTED_WORK.includes(fromDomain)) {
    notes.push("Dominio interno de la bandeja de laboratorio.");
  } else if (!brand) {
    notes.push(`Dominio del remitente: ${fromDomain}.`);
  }

  const failed = (["spf", "dkim", "dmarc"] as const).filter((key) => mail.auth[key] === "fail");
  if (failed.length > 0) {
    push(findings, {
      id: "auth-fail",
      category: "auth",
      severity: "high",
      title: "La autenticación del envío no cuadra",
      detail: `Falló ${failed.join(", ").toUpperCase()}. El servidor que mandó el correo no demuestra ser el dueño del dominio.`,
      points: 14,
    });
  } else if (mail.auth.spf === "pass" && mail.auth.dkim === "pass") {
    notes.push("SPF y DKIM pasan: el servidor de envío encaja con el dominio.");
  } else if (mail.auth.spf === "none" && mail.auth.dkim === "none") {
    notes.push("Esta vista no muestra SPF, DKIM ni DMARC. El sello se basa en remitente, texto, enlaces y adjuntos.");
  }
}

function analyzeContent(mail: Mail, findings: Finding[]): void {
  const haystack = `${mail.subject}\n${mail.bodyText}`.toLowerCase();

  const urgency =
    /urgente|inmediatamente|en las próximas \d+ horas|tu cuenta (será |ha sido )?suspend|bloquead|último aviso|actúa ahora|verifique (su|tu) cuenta/.test(
      haystack,
    );
  if (urgency) {
    push(findings, {
      id: "urgency",
      category: "content",
      severity: "medium",
      title: "Presiona para que actúes ya",
      detail:
        "El texto usa prisa o amenaza de bloqueo. Es un recurso habitual en correos que buscan un clic rápido.",
      points: 12,
    });
  }

  if (
    /contraseña|password|iniciar sesión|verifica(r)? (tu|su) identidad|actualiza (tus|sus) datos|código de seguridad|pin bancario/.test(
      haystack,
    )
  ) {
    push(findings, {
      id: "credentials",
      category: "content",
      severity: "high",
      title: "Pide datos de acceso o de cuenta",
      detail:
        "Un servicio serio no te pide la contraseña por correo. Si el enlace además es raro, no lo uses.",
      points: 20,
    });
  }

  if (/has ganado|premio|lotería|reembolso inmediato|transferencia pendiente de \d/.test(haystack)) {
    push(findings, {
      id: "prize",
      category: "content",
      severity: "medium",
      title: "Promete dinero o un premio",
      detail: "Habla de un premio o un pago inesperado. Conviene tratarlo como reclamo hasta demostrar lo contrario.",
      points: 10,
    });
  }

  if (/habilita(r)? (macros|contenido)|enable content|enable macros/.test(haystack)) {
    push(findings, {
      id: "macros",
      category: "content",
      severity: "high",
      title: "Pide activar macros o contenido",
      detail: "Activar macros o contenido dinámico en un adjunto es una vía clásica de infección.",
      points: 16,
    });
  }
}

function analyzeAttachments(mail: Mail): AttachmentReport[] {
  return mail.attachments.map((attachment) => {
    const findings: Finding[] = [];
    const pdfIndicators = isPdfName(attachment.name, attachment.mime) && attachment.rawContent
      ? analyzePdfStatic(attachment.rawContent)
      : [];

    if (attachment.kind === "exec") {
      findings.push({
        id: `${attachment.id}-exec`,
        category: "attachment",
        severity: "high",
        title: `${attachment.name} parece un programa`,
        detail: "Un ejecutable no debería llegar por correo de trabajo. Sello no lo abre.",
        points: 35,
      });
    }

    if (attachment.kind === "html") {
      findings.push({
        id: `${attachment.id}-html`,
        category: "attachment",
        severity: "high",
        title: `${attachment.name} es una página, no un documento`,
        detail: "Los adjuntos HTML pueden abrir un sitio falso en tu propio ordenador.",
        points: 18,
      });
    }

    for (const indicator of pdfIndicators) {
      if (indicator.severity === "low" && indicator.id === "acroform") continue;
      const points =
        indicator.severity === "high" ? (indicator.id === "javascript" ? 28 : 22) : indicator.severity === "medium" ? 10 : 4;
      findings.push({
        id: `${attachment.id}-${indicator.id}`,
        category: "attachment",
        severity: indicator.severity,
        title: `${attachment.name}: ${indicator.label.toLowerCase()}`,
        detail: indicator.detail,
        points,
      });
    }

    if (isPdfName(attachment.name, attachment.mime) && !attachment.rawContent) {
      findings.push({
        id: `${attachment.id}-no-bytes`,
        category: "attachment",
        severity: "low",
        title: "PDF sin muestra para analizar",
        detail: "No hay bytes de laboratorio en este adjunto, así que no se pudo hacer el análisis estático.",
        points: 0,
      });
    }

    return {
      attachmentId: attachment.id,
      name: attachment.name,
      kind: attachment.kind,
      findings,
      pdfIndicators,
    };
  });
}

function recommend(report: Omit<SecurityReport, "recommendations" | "summary">): string[] {
  const recs: string[] = [];
  const ids = new Set(report.findings.map((item) => item.id));

  if (report.level === "high") {
    recs.push("No pulses enlaces ni abras adjuntos hasta confirmar el envío por otro canal.");
  }
  if (ids.has("brand-spoof") || ids.has("lookalike-domain")) {
    recs.push("Entra a la web oficial escribiendo tú la dirección; no uses la de este correo.");
  }
  if (ids.has("credentials")) {
    recs.push("Ningún banco ni servicio te pedirá la contraseña en un email. Ignora ese paso.");
  }
  if (report.attachments.some((item) => item.pdfIndicators.length > 0)) {
    recs.push("El PDF no se ha ejecutado. Si lo necesitas, ábrelo en un visor sin JavaScript o pide una copia por otro medio.");
  }
  if (report.links.some((item) => item.suspicion !== "low")) {
    recs.push("Pasa el cursor por cada enlace y mira el destino real antes de decidir.");
  }
  if (ids.has("reply-to-mismatch")) {
    recs.push("No uses Responder: escribe tú la dirección que ya conoces, o llama.");
  }
  if (report.level === "low") {
    recs.push("No aparecen señales graves. Sigue siendo bueno no descargar cosas que no esperabas.");
  }
  return recs;
}

function summarize(level: RiskLevel, findings: Finding[]): string {
  if (findings.length === 0) {
    return "No hay indicios raros en el remitente, el texto, los enlaces ni los adjuntos.";
  }
  const main = findings.slice().sort((a, b) => b.points - a.points)[0];
  if (level === "high") {
    return `Hay señales claras de riesgo. La más pesada: ${main.title.toLowerCase()}.`;
  }
  if (level === "medium") {
    return `Hay indicios que merecen un segundo vistazo. Sobre todo: ${main.title.toLowerCase()}.`;
  }
  return `El correo se ve razonable. Se anotaron detalles menores, el primero: ${main.title.toLowerCase()}.`;
}

export function analyzeMail(mail: Mail): SecurityReport {
  const findings: Finding[] = [];
  const senderNotes: string[] = [];
  analyzeSender(mail, findings, senderNotes);
  analyzeContent(mail, findings);

  const links = extractLinks(mail.bodyHtml, mail.bodyText);
  for (const link of links) {
    if (link.suspicion === "high") {
      findings.push({
        id: `link-${link.href}`,
        category: "link",
        severity: "high",
        title: "Enlace con destino sospechoso",
        detail: `${link.reasons[0]} Destino: ${link.href}`,
        points: SHORTENERS.some((host) => link.href.includes(host)) ? 18 : 14,
      });
    } else if (link.suspicion === "medium") {
      findings.push({
        id: `link-mid-${link.href}`,
        category: "link",
        severity: "medium",
        title: "Enlace que conviene revisar",
        detail: `${link.reasons[0]} Destino: ${link.href}`,
        points: 6,
      });
    }
  }

  const attachments = analyzeAttachments(mail);
  for (const report of attachments) {
    findings.push(...report.findings);
  }

  const deducted = findings.reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, Math.min(100, 100 - deducted));
  const level = levelFromScore(score);
  const base = {
    mailId: mail.id,
    score,
    level,
    findings,
    links,
    attachments,
    senderNotes,
    agent: { status: "idle" as const },
  };

  return {
    ...base,
    summary: summarize(level, findings),
    recommendations: recommend(base),
    agent: { status: "idle" },
  };
}

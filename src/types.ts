export type FolderId =
  | "inbox"
  | "starred"
  | "sent"
  | "drafts"
  | "archive"
  | "trash";

export type RiskLevel = "low" | "medium" | "high";

export type AuthResult = "pass" | "fail" | "none";

export interface Address {
  name: string;
  email: string;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "pdf" | "image" | "doc" | "html" | "exec" | "other";
  rawContent?: string;
}

export interface MailAuth {
  spf: AuthResult;
  dkim: AuthResult;
  dmarc: AuthResult;
}

export interface Mail {
  id: string;
  folder: FolderId;
  starred: boolean;
  unread: boolean;
  date: string;
  from: Address;
  to: Address[];
  cc?: Address[];
  replyTo?: Address;
  subject: string;
  preview: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Attachment[];
  auth: MailAuth;
}

export interface Draft {
  to: string;
  subject: string;
  body: string;
  mode: "new" | "reply" | "forward";
  inReplyTo?: string;
}

export type FindingCategory =
  | "sender"
  | "auth"
  | "content"
  | "link"
  | "attachment";

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: RiskLevel;
  title: string;
  detail: string;
  points: number;
}

export interface AnalyzedLink {
  href: string;
  text: string;
  suspicion: RiskLevel;
  reasons: string[];
}

export interface PdfIndicator {
  id: string;
  label: string;
  detail: string;
  severity: RiskLevel;
}

export interface AttachmentReport {
  attachmentId: string;
  name: string;
  kind: Attachment["kind"];
  findings: Finding[];
  pdfIndicators: PdfIndicator[];
}

export type AgentStatus = "idle" | "loading" | "ready" | "error" | "unconfigured";

export interface AgentReview {
  status: AgentStatus;
  verdict?: string;
  observations?: string[];
  error?: string;
}

export interface SecurityReport {
  mailId: string;
  score: number;
  level: RiskLevel;
  summary: string;
  findings: Finding[];
  links: AnalyzedLink[];
  attachments: AttachmentReport[];
  senderNotes: string[];
  recommendations: string[];
  agent: AgentReview;
}

export type RiskFilter = "all" | RiskLevel;

export interface MailAdapterMeta {
  id: "mock" | "gmail";
  label: string;
  status: "ready" | "planned";
  note: string;
}

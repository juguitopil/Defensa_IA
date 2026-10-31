import {
  Archive,
  ArrowLeft,
  CornerUpLeft,
  Download,
  Forward,
  MailOpen,
  Paperclip,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { addressLine, formatAbsolute, formatSize } from "../lib/format";
import { sanitizeHtml } from "../lib/sanitize";
import { useMail } from "../store";
import type { Attachment, Mail } from "../types";
import { TrustStamp } from "./TrustStamp";

function quote(mail: Mail): string {
  return `\n\nEl ${formatAbsolute(mail.date)}, ${addressLine(mail.from)} escribió:\n> ${mail.bodyText.replace(/\n/g, "\n> ")}`;
}

export function ReadingPane() {
  const {
    selected,
    report,
    state,
    backToList,
    openCompose,
    toggleStar,
    toggleRead,
    archive,
    trash,
    ackHigh,
    askConfirm,
    toggleSecurity,
  } = useMail();

  if (!selected || !report) {
    return (
      <section className="flex min-w-0 flex-1 flex-col items-center justify-center bg-paper px-8 text-center">
        <p className="text-[1.15rem] font-semibold">Elige un correo</p>
        <p className="mt-2 max-w-sm text-[0.88rem] leading-relaxed text-muted">
          La capa de seguridad se calcula al vuelo: remitente, texto, enlaces y adjuntos. Nada se ejecuta.
        </p>
      </section>
    );
  }

  const showGate = report.level === "high" && !state.ackHigh[selected.id];

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-paper pb-16 md:pb-0">
      <div className="flex h-12 items-center gap-1 border-b border-line px-2">
        <button
          type="button"
          onClick={backToList}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sheet hover:text-ink lg:hidden"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="size-4" />
        </button>
        <Tool
          label="Responder"
          onClick={() =>
            openCompose({
              mode: "reply",
              to: selected.from.email,
              subject: selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`,
              body: quote(selected),
              inReplyTo: selected.id,
            })
          }
        >
          <CornerUpLeft className="size-4" />
        </Tool>
        <Tool
          label="Reenviar"
          onClick={() =>
            openCompose({
              mode: "forward",
              subject: selected.subject.startsWith("RV:") ? selected.subject : `RV: ${selected.subject}`,
              body: quote(selected),
            })
          }
        >
          <Forward className="size-4" />
        </Tool>
        <Tool
          label={selected.starred ? "Quitar destacado" : "Destacar"}
          onClick={() => toggleStar(selected.id)}
        >
          <Star className={`size-4 ${selected.starred ? "fill-mid text-mid" : ""}`} />
        </Tool>
        <Tool
          label={selected.unread ? "Marcar leído" : "Marcar no leído"}
          onClick={() => toggleRead(selected.id)}
        >
          <MailOpen className="size-4" />
        </Tool>
        <Tool label="Archivar" onClick={() => archive(selected.id)}>
          <Archive className="size-4" />
        </Tool>
        <Tool
          label={selected.folder === "trash" ? "Eliminar del todo" : "Eliminar"}
          onClick={() => trash(selected.id)}
        >
          <Trash2 className="size-4" />
        </Tool>
        <button
          type="button"
          onClick={() => toggleSecurity()}
          className="ml-auto mr-1 flex h-8 items-center gap-1.5 rounded-lg px-2 text-[0.75rem] font-semibold text-navy hover:bg-sheet"
        >
          {state.securityOpen ? "Ocultar seguridad" : "Ver seguridad"}
        </button>
      </div>

      <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
        {showGate && (
          <div className="mx-6 mt-5 rounded-2xl bg-high-wash px-5 py-4 text-high">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">Este correo tiene alto riesgo</p>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-high/90">{report.summary}</p>
                <p className="mt-2 text-[0.82rem] leading-relaxed">
                  Puedes leerlo. No abras enlaces ni adjuntos si no has comprobado el envío por otro medio.
                </p>
                <button
                  type="button"
                  onClick={() => ackHigh(selected.id)}
                  className="mt-3 h-8 rounded-lg bg-high px-3 text-[0.78rem] font-semibold text-sheet"
                >
                  Quiero leerlo igual
                </button>
              </div>
            </div>
          </div>
        )}

        <article className="px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="max-w-[40rem] text-[1.45rem] font-semibold leading-snug tracking-tight">
              {selected.subject}
            </h2>
            <TrustStamp score={report.score} level={report.level} size="md" />
          </div>

          <div className="mt-5 flex items-start gap-3">
            <div>
              <p className="font-semibold">{selected.from.name}</p>
              <p className="text-[0.78rem] text-muted">{selected.from.email}</p>
              <p className="mt-1 text-[0.75rem] text-faint">
                Para {selected.to.map((item) => (item.email === state.account.email ? "mí" : item.name)).join(", ")}
                {selected.cc?.length ? ` · CC ${selected.cc.map((item) => item.name).join(", ")}` : ""}
              </p>
            </div>
            <time className="ml-auto shrink-0 text-[0.75rem] text-faint" dateTime={selected.date}>
              {formatAbsolute(selected.date)}
            </time>
          </div>

          <div
            className="reading-body mt-8 text-ink"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.bodyHtml) }}
            onClick={(event) => {
              const target = event.target as HTMLElement;
              const anchor = target.closest("a");
              if (!anchor) return;
              event.preventDefault();
              const href = anchor.getAttribute("href") ?? "";
              if (report.level === "high" || report.links.some((link) => link.href === href && link.suspicion !== "low")) {
                askConfirm({
                  kind: "link",
                  mailId: selected.id,
                  label: href,
                  href,
                });
                return;
              }
              window.open(href, "_blank", "noopener,noreferrer");
            }}
          />

          {selected.attachments.length > 0 && (
            <div className="mt-10">
              <p className="flex items-center gap-2 text-[0.78rem] font-semibold text-muted">
                <Paperclip className="size-3.5" />
                {selected.attachments.length === 1
                  ? "1 adjunto"
                  : `${selected.attachments.length} adjuntos`}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {selected.attachments.map((attachment) => (
                  <AttachmentRow
                    key={attachment.id}
                    attachment={attachment}
                    risky={
                      report.level === "high" ||
                      report.attachments.some(
                        (item) => item.attachmentId === attachment.id && item.findings.length > 0,
                      )
                    }
                    onOpen={() =>
                      askConfirm({
                        kind: "attachment",
                        mailId: selected.id,
                        label: attachment.name,
                        attachmentId: attachment.id,
                      })
                    }
                  />
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function Tool({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sheet hover:text-ink"
    >
      {children}
    </button>
  );
}

function AttachmentRow({
  attachment,
  risky,
  onOpen,
}: {
  attachment: Attachment;
  risky: boolean;
  onOpen: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-sheet px-3 py-2.5 ring-1 ring-line">
      <span className="grid size-9 place-items-center rounded-lg bg-paper text-[0.68rem] font-semibold uppercase text-navy">
        {attachment.kind === "pdf" ? "PDF" : attachment.kind === "html" ? "HTM" : "DOC"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.88rem] font-medium">{attachment.name}</p>
        <p className="text-[0.72rem] text-muted">{formatSize(attachment.size)}</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[0.75rem] font-semibold ${
          risky ? "bg-mid-wash text-mid" : "bg-paper text-navy"
        }`}
      >
        <Download className="size-3.5" />
        {risky ? "Revisar" : "Descargar"}
      </button>
    </li>
  );
}

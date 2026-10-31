import { seedMails } from "../../data/seed";
import { ME } from "../format";
import type { MailAdapter } from "./types";
import type { Mail } from "../../types";

function uid(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createMockAdapter(initial: Mail[] = seedMails): MailAdapter {
  let mailbox = initial.map((mail) => ({ ...mail }));

  return {
    meta: {
      id: "mock",
      label: "Bandeja de laboratorio",
      status: "ready",
      note: "Datos de ejemplo. Ningún correo real sale ni entra de esta máquina.",
    },
    async list() {
      return mailbox.map((mail) => ({ ...mail }));
    },
    async send({ to, subject, body, inReplyTo }) {
      const now = new Date().toISOString();
      const mail: Mail = {
        id: uid(),
        folder: "sent",
        starred: false,
        unread: false,
        date: now,
        from: ME,
        to: [{ name: to, email: to }],
        subject: subject || "(sin asunto)",
        preview: body.slice(0, 140),
        bodyText: body,
        bodyHtml: `<p>${body.replace(/\n/g, "<br/>")}</p>`,
        attachments: [],
        auth: { spf: "pass", dkim: "pass", dmarc: "pass" },
      };
      mailbox = [mail, ...mailbox];
      if (inReplyTo) {
        mailbox = mailbox.map((item) =>
          item.id === inReplyTo ? { ...item, unread: false } : item,
        );
      }
      return mail;
    },
  };
}

export const activeAdapter = createMockAdapter();

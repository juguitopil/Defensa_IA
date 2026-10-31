import type { Mail, MailAdapterMeta } from "../../types";

export interface MailAdapter {
  meta: MailAdapterMeta;
  list(): Promise<Mail[]>;
  send(input: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
  }): Promise<Mail>;
  persist?(mails: Mail[]): Promise<void>;
}

import { activeAdapter } from "./mock";
import type { MailAdapter } from "./types";

export function getMailAdapter(): MailAdapter {
  return activeAdapter;
}

export { createGmailAdapter } from "./gmail";
export type { MailAdapter } from "./types";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

/** Sends an e-mail (Resend online; a fake one in tests). Throws when it fails. */
export type SendEmail = (message: EmailMessage) => Promise<void>;

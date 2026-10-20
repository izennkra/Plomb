import { Resend } from "resend";
import type { SendEmail } from "./email-sender";

/** Resend's test sender: works without your own domain, but only towards the Resend account's own address. */
export const DEFAULT_FROM = "Plomb <onboarding@resend.dev>";

/** Sends e-mails through Resend (RESEND_API_KEY). */
export function createResendSender({ apiKey, from = DEFAULT_FROM }: { apiKey: string; from?: string }): SendEmail {
  if (!apiKey) throw new Error("Clé Resend manquante (réglage RESEND_API_KEY).");
  const resend = new Resend(apiKey);
  return async ({ to, subject, html, text }) => {
    const { error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) throw new Error(`L'e-mail n'a pas pu partir : ${error.message}`);
  };
}

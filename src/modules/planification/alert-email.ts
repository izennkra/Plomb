import type { EmailMessage } from "./email-sender";

const longDay = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${day}T12:00:00Z`),
  );

/** "Your journal could not be prepared": rather than silence. */
export function renderAlertEmail(day: string, reason: string, { to, journalUrl }: { to: string; journalUrl: string }): EmailMessage {
  const subject = `Votre journal Plomb du ${longDay(day)} n'a pas pu être préparé`;
  const text = `${subject}.\n\nRaison : ${reason}\n\nPlomb réessaiera au prochain passage. Vous pouvez aussi le préparer à la main : ${journalUrl}`;
  const html = `<!doctype html><html lang="fr"><body style="font-family:Helvetica,Arial,sans-serif;color:#111;padding:24px">
<p style="font:700 22px Georgia,serif;margin:0 0 16px">Plomb</p>
<p>${subject}.</p>
<p style="color:#6b6b6b">Raison : ${reason.replace(/</g, "&lt;")}</p>
<p>Plomb réessaiera au prochain passage. Vous pouvez aussi <a href="${journalUrl}">le préparer à la main</a>.</p>
</body></html>`;
  return { to, subject, text, html };
}

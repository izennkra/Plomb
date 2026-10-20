import type { Edition, EditionItem } from "@/db/schema";

export type EditionEmail = { subject: string; html: string; text: string };

const EXCERPT_LENGTH = 320;

const longDay = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${day}T12:00:00Z`),
  );

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function excerpt(text: string): string {
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/**
 * The 9:00 e-mail: "your journal is ready", a taste of the Une, and a link to read the whole edition.
 * (Sent by the `planification` brick.)
 */
export function renderEditionEmail(edition: Edition, items: EditionItem[], { journalUrl }: { journalUrl: string }): EditionEmail {
  const date = longDay(edition.day);
  const subject = `Votre journal Plomb du ${date} est prêt`;
  const une = items.find((item) => item.placement === "une");
  const secondary = items.filter((item) => item.placement === "secondaire");
  const others = items.length - (une ? 1 : 0) - secondary.length;
  const uneText = une ? excerpt(une.leadText ?? une.summary ?? "") : "";

  const text = [
    subject,
    "",
    ...(une
      ? [
          `À LA UNE — ${une.title} (${une.sourceName})`,
          uneText,
          "",
          ...secondary.map((item) => `• ${item.title} (${item.sourceName})`),
          ...(others > 0 ? [`… et ${others} autre${others > 1 ? "s" : ""} article${others > 1 ? "s" : ""}.`] : []),
        ]
      : [edition.message ?? "Pas de nouvelles de vos sources depuis la dernière édition."]),
    "",
    `Lire le journal : ${journalUrl}`,
  ].join("\n");

  const image = une?.images[0];
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#fafaf7;font-family:Georgia,'Times New Roman',serif;color:#111">
  <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse">
    <tr><td style="padding:0 0 16px;border-bottom:2px solid #111">
      <p style="margin:0;font:700 28px/1 Georgia,serif;letter-spacing:-0.5px">Plomb</p>
      <p style="margin:6px 0 0;font:14px/1.4 Helvetica,Arial,sans-serif;color:#6b6b6b">Votre journal du ${escape(date)}</p>
    </td></tr>
    ${
      une
        ? `<tr><td style="padding:24px 0 8px">
      <p style="margin:0 0 8px;font:700 11px/1 Helvetica,Arial,sans-serif;letter-spacing:1px;text-transform:uppercase">À la Une · ${escape(une.sourceName)}</p>
      ${image ? `<img src="${escape(image)}" alt="" width="600" style="display:block;width:100%;height:auto;margin:0 0 12px">` : ""}
      <h1 style="margin:0 0 8px;font:700 24px/1.25 Georgia,serif">${escape(une.title)}</h1>
      <p style="margin:0;font:16px/1.55 Georgia,serif">${escape(uneText)}</p>
    </td></tr>
    ${secondary
      .map(
        (item) => `<tr><td style="padding:16px 0 0;border-top:1px solid #e2e2e2">
      <p style="margin:0 0 4px;font:12px/1 Helvetica,Arial,sans-serif;color:#6b6b6b">${escape(item.sourceName)}</p>
      <p style="margin:0;font:700 17px/1.3 Georgia,serif">${escape(item.title)}</p>
    </td></tr>`,
      )
      .join("")}
    ${others > 0 ? `<tr><td style="padding:16px 0 0;font:14px/1.4 Helvetica,Arial,sans-serif;color:#6b6b6b">… et ${others} autre${others > 1 ? "s" : ""} article${others > 1 ? "s" : ""} dans votre édition.</td></tr>` : ""}`
        : `<tr><td style="padding:24px 0;font:16px/1.5 Georgia,serif">${escape(edition.message ?? "Pas de nouvelles de vos sources depuis la dernière édition.")}</td></tr>`
    }
    <tr><td style="padding:28px 0">
      <a href="${escape(journalUrl)}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;font:700 15px/1 Helvetica,Arial,sans-serif">Lire le journal</a>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

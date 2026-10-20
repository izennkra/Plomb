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

  // Copies of social images are served by Plomb (/media/…): the e-mail needs their full address.
  const image = une?.images[0] ? new URL(une.images[0], journalUrl).toString() : undefined;
  // Plomb's look (grey, orange Une, black blocks), with e-mail-safe fonts when Diatype is not installed.
  const font = "'ABC Diatype Compressed','ABC Diatype Compressed Trial','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  const logo = [..."Plomb"]
    .map((letter) => `<td style="padding:0 2px 0 0"><span style="display:block;padding:3px 4px 2px;background:#000;color:#eaeaea;font:500 20px/1 ${font}">${letter}</span></td>`)
    .join("");
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:28px 12px;background:#eaeaea;font-family:${font};color:#000">
  <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;border-collapse:collapse">
    <tr><td align="center" style="padding:0 0 22px"><table role="presentation" style="border-collapse:collapse"><tr>${logo}</tr></table></td></tr>
    ${
      une
        ? `<tr><td style="padding:24px 24px 20px;background:#f08f35;border-radius:6px">
      <p style="margin:0 0 14px;font:400 30px/1.04 ${font}">${escape(une.title)}</p>
      ${image ? `<img src="${escape(image)}" alt="" width="552" style="display:block;width:100%;height:auto;margin:0 0 14px;border-radius:4px">` : ""}
      <p style="margin:0 0 18px;font:400 16px/1.25 ${font}">${escape(uneText)}</p>
      <span style="display:inline-block;padding:3px 6px 2px;background:#000;color:#f08f35;border-radius:3px;font:400 13px/1 ${font}">Édition N°${edition.id} · ${escape(date)}</span>
    </td></tr>
    ${secondary
      .map(
        (item) => `<tr><td style="padding:8px 0 0"><table role="presentation" width="100%" style="border-collapse:collapse;background:#a8a8a8;border-radius:6px"><tr><td style="padding:10px 12px 12px;color:#fff">
      <p style="margin:0 0 6px;font:400 11px/1 ${font}">${escape(item.sourceName)}</p>
      <p style="margin:0;font:400 20px/1.08 ${font}">${escape(item.title)}</p>
    </td></tr></table></td></tr>`,
      )
      .join("")}
    ${others > 0 ? `<tr><td style="padding:12px 0 0;font:400 14px/1.3 ${font}">… et ${others} autre${others > 1 ? "s" : ""} article${others > 1 ? "s" : ""} dans ton édition.</td></tr>` : ""}`
        : `<tr><td style="padding:24px;background:#f08f35;border-radius:6px;font:400 24px/1.1 ${font}">${escape(edition.message ?? "Pas de nouvelles de tes sources depuis la dernière édition.")}</td></tr>`
    }
    <tr><td style="padding:24px 0">
      <a href="${escape(journalUrl)}" style="display:inline-block;padding:7px 14px 6px;background:#000;color:#fff;border-radius:4px;text-decoration:none;font:400 16px/1 ${font}">Lire le journal</a>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

import { describe, expect, it } from "vitest";
import type { Edition, EditionItem } from "@/db/schema";
import { renderEditionEmail } from "@/modules/edition/email";

const edition = { id: 1, day: "2026-10-21", message: "4 articles" } as Edition;
const item = (placement: EditionItem["placement"], title: string, extra: Partial<EditionItem> = {}) =>
  ({ placement, title, sourceName: "the-brandidentity.com", summary: `Résumé ${title}`, leadText: null, images: [], ...extra }) as EditionItem;

const journalUrl = "http://localhost:3000/journal?edition=1";

describe("renderEditionEmail", () => {
  const items = [
    item("une", "Le beurre <Madeleine>", { leadText: "À Melbourne, ".repeat(60), images: ["https://img/une.jpg"] }),
    item("secondaire", "Une typo illisible"),
    item("secondaire", "Fulham change de lettres"),
    item("suite", "Autre"),
  ];

  it("announces the journal of the day with a taste of the Une", () => {
    const email = renderEditionEmail(edition, items, { journalUrl });
    expect(email.subject).toBe("Votre journal Plomb du mercredi 21 octobre est prêt");
    expect(email.text).toContain("À LA UNE — Le beurre <Madeleine> (the-brandidentity.com)");
    expect(email.text).toContain("• Une typo illisible");
    expect(email.text).toContain("… et 1 autre article.");
    expect(email.text).toContain(`Lire le journal : ${journalUrl}`);
  });

  it("keeps the excerpt short and the HTML safe", () => {
    const { html, text } = renderEditionEmail(edition, items, { journalUrl });
    expect(text.split("\n")[3].length).toBeLessThanOrEqual(330);
    expect(html).toContain("Le beurre &lt;Madeleine&gt;");
    expect(html).not.toContain("<Madeleine>");
    expect(html).toContain('src="https://img/une.jpg"');
    expect(html).toContain(`href="${journalUrl}"`);
  });

  it("says so when there is no news", () => {
    const empty = { ...edition, message: "Pas de nouvelles de vos sources depuis la dernière édition." };
    expect(renderEditionEmail(empty, [], { journalUrl }).text).toContain("Pas de nouvelles");
  });
});

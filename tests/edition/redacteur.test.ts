import { beforeEach, describe, expect, it } from "vitest";
import { createJsonRedacteur, RedacteurError } from "@/modules/edition/redacteur/json-redacteur";

/** A fake AI: answers the queued replies in order (a string is an unreadable answer). */
let replies: unknown[] = [];
let schemas: object[] = [];
beforeEach(() => {
  replies = [];
  schemas = [];
});

const redacteur = () =>
  createJsonRedacteur({
    model: "test-model",
    parallel: 1,
    ask: async (_prompt, schema) => {
      schemas.push(schema);
      const reply = replies.shift();
      if (reply === undefined || typeof reply === "string") throw new RedacteurError("Réponse illisible.");
      return reply;
    },
  });

const article = { title: "Studio Hi Ho", content: "Madeleine is a butter maker…", excerpt: null, sourceName: "the-brandidentity.com" };
const answer = (extra: object = {}) => ({
  titre: "Le beurre de Madeleine",
  resume: "Studio Hi Ho signe…",
  theme: "Packaging",
  sujet: "Madeleine",
  notoriete: 1,
  ampleur: 3,
  auteurs: 2,
  portee: 1,
  qualite: 5,
  ...extra,
});

describe("the editor's checks (whatever the AI)", () => {
  it("writes a summary from a valid JSON answer", async () => {
    replies.push(answer());
    expect(await redacteur().summarize(article)).toEqual({
      title: "Le beurre de Madeleine",
      summary: "Studio Hi Ho signe…",
      theme: "Packaging",
      subject: "Madeleine",
      criteria: { notoriety: 1, scale: 3, authors: 2, reach: 1, quality: 5 },
      importance: expect.closeTo(3.36, 2),
    });
    expect(schemas[0]).toMatchObject({ type: "object" });
  });

  it("tries again after an incomplete answer", async () => {
    replies.push(answer({ theme: "Cuisine" }), answer());
    expect((await redacteur().summarize(article)).theme).toBe("Packaging");
  });

  it("keeps each criterion between 1 and 5", async () => {
    replies.push(answer({ notoriete: 9, ampleur: 0 }));
    expect((await redacteur().summarize(article)).criteria).toMatchObject({ notoriety: 5, scale: 1 });
  });

  it("refuses an answer with a missing criterion", async () => {
    replies.push(answer({ portee: "beaucoup" }), answer({ portee: undefined }));
    await expect(redacteur().summarize(article)).rejects.toThrow(/réponse incomplète/);
  });

  it("writes the longer text of the Une", async () => {
    replies.push({ texte: "  À Melbourne, Madeleine…  " });
    expect(await redacteur().writeLead(article)).toBe("À Melbourne, Madeleine…");
  });

  describe("editorial meeting", () => {
    const candidates = ["Coca-Cola", "Café matcha", "MoMA PS1", "Fulham"].map((title, index) => ({
      title,
      summary: "…",
      subject: title,
      sourceName: "s",
      coveredBy: [],
      importance: 8 - index,
    }));

    it("returns the chosen positions (the AI numbers from 1)", async () => {
      replies.push({ une: 1, secondaires: [3, 4], raison: "Coca-Cola, événement mondial" });
      expect(await redacteur().chooseFrontPage(candidates)).toEqual({ une: 0, secondary: [2, 3] });
    });

    it("refuses an incoherent choice (unknown or repeated number)", async () => {
      replies.push({ une: 9, secondaires: [1, 2], raison: "" });
      await expect(redacteur().chooseFrontPage(candidates)).rejects.toThrow(/incohérente/);
      replies.push({ une: 2, secondaires: [2, 3], raison: "" });
      await expect(redacteur().chooseFrontPage(candidates)).rejects.toThrow(/incohérente/);
    });
  });
});

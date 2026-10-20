import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createOllamaRedacteur } from "@/modules/edition/redacteur/ollama";
import { startTestServer, type TestServer } from "../helpers/test-server";

/** A fake Ollama: answers the queued replies in order. */
let replies: { status?: number; content: string }[] = [];
let requests: { model: string; format: unknown }[] = [];
let server: TestServer;

beforeAll(async () => {
  server = await startTestServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push(JSON.parse(body));
      const reply = replies.shift() ?? { content: "{}" };
      res.writeHead(reply.status ?? 200, { "content-type": "application/json" }).end(JSON.stringify({ message: { content: reply.content } }));
    });
  });
});

afterAll(() => server.close());
beforeEach(() => {
  replies = [];
  requests = [];
});

const article = { title: "Studio Hi Ho", content: "Madeleine is a butter maker…", excerpt: null, sourceName: "the-brandidentity.com" };
const redacteur = () => createOllamaRedacteur({ model: "test-model", baseUrl: server.base });
const answer = (extra: object = {}) =>
  JSON.stringify({
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
const valid = answer();

describe("Ollama redacteur", () => {
  it("writes a summary from a valid JSON answer", async () => {
    replies.push({ content: valid });
    expect(await redacteur().summarize(article)).toEqual({
      title: "Le beurre de Madeleine",
      summary: "Studio Hi Ho signe…",
      theme: "Packaging",
      subject: "Madeleine",
      criteria: { notoriety: 1, scale: 3, authors: 2, reach: 1, quality: 5 },
      importance: expect.closeTo(3.36, 2),
    });
    expect(requests[0]).toMatchObject({ model: "test-model", format: { type: "object" } });
  });

  it("tries again after an unreadable or incomplete answer", async () => {
    replies.push({ content: "not json" }, { content: valid });
    expect((await redacteur().summarize(article)).theme).toBe("Packaging");

    replies.push({ content: answer({ theme: "Cuisine" }) }, { content: valid });
    expect((await redacteur().summarize(article)).theme).toBe("Packaging");
  });

  it("keeps each criterion between 1 and 5", async () => {
    replies.push({ content: answer({ notoriete: 9, ampleur: 0 }) });
    expect((await redacteur().summarize(article)).criteria).toMatchObject({ notoriety: 5, scale: 1 });
  });

  it("refuses an answer with a missing criterion", async () => {
    replies.push({ content: answer({ portee: "beaucoup" }) }, { content: answer({ portee: undefined }) });
    await expect(redacteur().summarize(article)).rejects.toThrow(/réponse incomplète/);
  });

  it("gives up with a clear error after repeated failures", async () => {
    replies.push({ status: 500, content: "" }, { status: 500, content: "" });
    await expect(redacteur().summarize(article)).rejects.toThrow(/n'a pas pu écrire/);
  });

  it("explains when the AI is not running", async () => {
    const offline = createOllamaRedacteur({ model: "m", baseUrl: "http://127.0.0.1:1", attempts: 1 });
    await expect(offline.summarize(article)).rejects.toThrow(/Ollama est-il lancé/);
  });

  it("writes the longer text of the Une", async () => {
    replies.push({ content: JSON.stringify({ texte: "  À Melbourne, Madeleine…  " }) });
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
      replies.push({ content: JSON.stringify({ une: 1, secondaires: [3, 4], raison: "Coca-Cola, événement mondial" }) });
      expect(await redacteur().chooseFrontPage(candidates)).toEqual({ une: 0, secondary: [2, 3] });
    });

    it("refuses an incoherent choice (unknown or repeated number)", async () => {
      replies.push({ content: JSON.stringify({ une: 9, secondaires: [1, 2], raison: "" }) });
      await expect(redacteur().chooseFrontPage(candidates)).rejects.toThrow(/incohérente/);
      replies.push({ content: JSON.stringify({ une: 2, secondaires: [2, 3], raison: "" }) });
      await expect(redacteur().chooseFrontPage(candidates)).rejects.toThrow(/incohérente/);
    });
  });
});

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
const valid = JSON.stringify({ titre: "Le beurre de Madeleine", resume: "Studio Hi Ho signe…", theme: "Packaging", importance: 8 });

describe("Ollama redacteur", () => {
  it("writes a summary from a valid JSON answer", async () => {
    replies.push({ content: valid });
    expect(await redacteur().summarize(article)).toEqual({
      title: "Le beurre de Madeleine",
      summary: "Studio Hi Ho signe…",
      theme: "Packaging",
      importance: 8,
    });
    expect(requests[0]).toMatchObject({ model: "test-model", format: { type: "object" } });
  });

  it("tries again after an unreadable or incomplete answer", async () => {
    replies.push({ content: "not json" }, { content: valid });
    expect((await redacteur().summarize(article)).theme).toBe("Packaging");

    replies.push({ content: JSON.stringify({ titre: "x", resume: "y", theme: "Cuisine", importance: 5 }) }, { content: valid });
    expect((await redacteur().summarize(article)).theme).toBe("Packaging");
  });

  it("keeps the note between 1 and 10", async () => {
    replies.push({ content: JSON.stringify({ titre: "t", resume: "r", theme: "Typographie", importance: 14 }) });
    expect((await redacteur().summarize(article)).importance).toBe(10);
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
});

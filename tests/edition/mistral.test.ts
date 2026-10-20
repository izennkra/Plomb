import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMistralRedacteur } from "@/modules/edition/redacteur/mistral";
import { startTestServer, type TestServer } from "../helpers/test-server";

/** A fake Mistral API: answers the queued replies in order and records the requests. */
let replies: { status?: number; content?: string }[] = [];
let requests: { auth?: string; body: { model: string; response_format: unknown; messages: { role: string }[] } }[] = [];
let server: TestServer;

beforeAll(async () => {
  server = await startTestServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push({ auth: req.headers.authorization, body: JSON.parse(body) });
      const reply = replies.shift() ?? { content: "{}" };
      res
        .writeHead(reply.status ?? 200, { "content-type": "application/json" })
        .end(JSON.stringify({ choices: [{ message: { content: reply.content ?? "" } }] }));
    });
  });
});

afterAll(() => server.close());
beforeEach(() => {
  replies = [];
  requests = [];
});

const article = { title: "Fulham FC", content: "Music and F37 Foundry…", excerpt: null, sourceName: "itsnicethat.com" };
const redacteur = () =>
  createMistralRedacteur({ apiKey: "test-key", baseUrl: server.base, sleep: async () => {} });
const valid = JSON.stringify({
  titre: "Fulham réinvente son identité",
  resume: "Music et F37…",
  theme: "Identité",
  sujet: "Fulham F.C.",
  notoriete: 4,
  ampleur: 5,
  auteurs: 4,
  portee: 3,
  qualite: 4,
});

describe("Mistral redacteur", () => {
  it("writes a summary through the Mistral API (JSON mode, key sent)", async () => {
    replies.push({ content: valid });

    const summary = await redacteur().summarize(article);

    expect(summary).toMatchObject({ title: "Fulham réinvente son identité", subject: "Fulham F.C.", theme: "Identité" });
    expect(summary.importance).toBeGreaterThan(7);
    expect(requests[0]).toMatchObject({
      auth: "Bearer test-key",
      body: { model: "mistral-small-latest", response_format: { type: "json_object" } },
    });
    expect(requests[0].body.messages.map((message) => message.role)).toEqual(["system", "user"]);
  });

  it("waits and tries again when Mistral is busy (429, 503)", async () => {
    replies.push({ status: 429 }, { status: 503 }, { content: valid });
    expect((await redacteur().summarize(article)).subject).toBe("Fulham F.C.");
    expect(requests).toHaveLength(3);
  });

  it("stops at once with a clear message when the key is refused", async () => {
    replies.push({ status: 401 });
    await expect(redacteur().summarize(article)).rejects.toThrow(/clé Mistral refusée/);
    expect(requests).toHaveLength(1);
  });

  it("refuses to start without a key", () => {
    expect(() => createMistralRedacteur({ apiKey: "" })).toThrow(/Clé Mistral manquante/);
  });

  it("writes several articles at the same time", () => {
    expect(redacteur().parallel).toBe(4);
  });
});

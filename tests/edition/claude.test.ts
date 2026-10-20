import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClaudeRedacteur, toStructuredSchema } from "@/modules/edition/redacteur/claude";
import { FatalRedacteurError } from "@/modules/edition/redacteur/json-redacteur";
import { SUMMARY_SCHEMA } from "@/modules/edition/redacteur/prompts";
import { startTestServer, type TestServer } from "../helpers/test-server";

type Sent = { path?: string; key?: string; body: Record<string, unknown> };

/** A fake Claude API (Messages): answers the queued replies in order and records the requests. */
let replies: { status?: number; text?: string; stopReason?: string; error?: string }[] = [];
let requests: Sent[] = [];
let server: TestServer;

beforeAll(async () => {
  server = await startTestServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push({ path: req.url, key: req.headers["x-api-key"] as string, body: JSON.parse(body) });
      const reply = replies.shift() ?? { text: "{}" };
      if (reply.status && reply.status >= 400) {
        res
          .writeHead(reply.status, { "content-type": "application/json" })
          .end(JSON.stringify({ type: "error", error: { type: "error", message: reply.error ?? "error" } }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-haiku-5-5",
          content: [
            { type: "thinking", thinking: "", signature: "sig" },
            { type: "text", text: reply.text ?? "" },
          ],
          stop_reason: reply.stopReason ?? "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      );
    });
  });
});

afterAll(() => server.close());
beforeEach(() => {
  replies = [];
  requests = [];
});

const article = { title: "Fulham FC", content: "Music and F37 Foundry…", excerpt: null, sourceName: "itsnicethat.com" };
const redacteur = () => createClaudeRedacteur({ apiKey: "test-key", baseURL: server.base });
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

describe("Claude redacteur", () => {
  it("writes a summary with Claude Haiku 5.5, structured output, low effort, no sampling settings", async () => {
    replies.push({ text: valid });

    const summary = await redacteur().summarize(article);

    expect(summary).toMatchObject({ title: "Fulham réinvente son identité", subject: "Fulham F.C." });
    const [sent] = requests;
    expect(sent.path).toBe("/v1/messages");
    expect(sent.key).toBe("test-key");
    expect(sent.body).toMatchObject({
      model: "claude-haiku-5-5",
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    expect(sent.body).not.toHaveProperty("temperature");
    expect(typeof sent.body.system).toBe("string");
  });

  it("reads the answer by block type (a thinking block may come first)", async () => {
    replies.push({ text: JSON.stringify({ texte: "À Londres, Fulham…" }) });
    expect(await redacteur().writeLead(article)).toBe("À Londres, Fulham…");
  });

  it("a refused key stops everything (the reader will be alerted)", async () => {
    replies.push({ status: 401, error: "invalid x-api-key" });
    await expect(redacteur().summarize(article)).rejects.toBeInstanceOf(FatalRedacteurError);
  });

  it("an empty credit stops everything too, with a clear message", async () => {
    replies.push({ status: 400, error: "Your credit balance is too low to access the Anthropic API." });
    await expect(redacteur().summarize(article)).rejects.toThrow(/crédit Claude épuisé/);
  });

  it("a refusal on one article is an ordinary error (that article falls back on the media's text)", async () => {
    replies.push({ text: "", stopReason: "refusal" });
    const error = await redacteur().summarize(article).catch((e) => e);
    expect(error.message).toMatch(/refusé/);
    expect(error).not.toBeInstanceOf(FatalRedacteurError);
  });

  it("refuses to start without a key", () => {
    expect(() => createClaudeRedacteur({ apiKey: "" })).toThrow(/Clé Claude manquante/);
  });
});

describe("toStructuredSchema", () => {
  it("closes objects and leaves number bounds to Plomb's checks", () => {
    const schema = toStructuredSchema(SUMMARY_SCHEMA) as { additionalProperties: boolean; properties: Record<string, object> };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.notoriete).toEqual({ type: "integer" });
  });
});

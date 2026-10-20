import Anthropic from "@anthropic-ai/sdk";
import { createJsonRedacteur, FatalRedacteurError, RedacteurError } from "./json-redacteur";
import { SYSTEM_PROMPT } from "./prompts";
import type { Redacteur } from "./types";

/** Chosen by Izenn (2026-10-20): fast and inexpensive (~0.60 $ a month for a daily journal of 50 articles). */
export const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";

type Options = {
  apiKey: string;
  model?: string;
  /** Tests: a fake API. */
  baseURL?: string;
  timeoutMs?: number;
  /** Articles written at the same time (stays within the 5-minute limit of the online host). */
  parallel?: number;
};

/**
 * Editor in the cloud through Claude's API: works even when the Mac is off. Answers are constrained to the exact
 * JSON format (structured outputs), then checked like any other AI's.
 */
export function createClaudeRedacteur({
  apiKey,
  model = DEFAULT_CLAUDE_MODEL,
  baseURL,
  timeoutMs = 60_000,
  parallel = 4,
}: Options): Redacteur {
  if (!apiKey) throw new FatalRedacteurError("Clé Claude manquante (réglage ANTHROPIC_API_KEY).");
  // The SDK retries by itself when the API is busy (429) or has a hiccup (5xx).
  const client = new Anthropic({ apiKey, baseURL, timeout: timeoutMs, maxRetries: 3 });

  return createJsonRedacteur({
    model,
    parallel,
    async ask(prompt, schema) {
      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model,
          // Room for the model's short thinking plus the answer.
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          // Summaries don't need deep reasoning: low effort keeps it fast and cheap.
          output_config: { effort: "low", format: { type: "json_schema", schema: toStructuredSchema(schema) } },
          messages: [{ role: "user", content: prompt }],
        });
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          throw new FatalRedacteurError("Le rédacteur n'a pas pu écrire : clé Claude refusée (vérifiez ANTHROPIC_API_KEY).");
        }
        if (error instanceof Anthropic.RateLimitError) {
          throw new RedacteurError("Le rédacteur n'a pas pu écrire : trop de demandes à Claude, réessai au prochain passage.");
        }
        if (error instanceof Anthropic.BadRequestError && /credit|balance|billing/i.test(error.message)) {
          throw new FatalRedacteurError("Le rédacteur n'a pas pu écrire : crédit Claude épuisé (console.anthropic.com → Billing).");
        }
        if (error instanceof Anthropic.APIError) {
          throw new RedacteurError(`Le rédacteur n'a pas pu écrire : Claude a répondu ${error.status ?? "une erreur"}.`);
        }
        throw new RedacteurError("Le rédacteur n'a pas pu écrire : Claude injoignable.");
      }

      if (response.stop_reason === "refusal") {
        throw new RedacteurError("Le rédacteur n'a pas pu écrire : Claude a refusé cet article.");
      }
      const text = response.content.find((block) => block.type === "text");
      if (!text || text.type !== "text") throw new RedacteurError("Le rédacteur n'a pas pu écrire : réponse vide.");
      try {
        return JSON.parse(text.text);
      } catch {
        throw new RedacteurError("Le rédacteur n'a pas pu écrire : réponse illisible.");
      }
    },
  });
}

/**
 * Structured outputs accept a subset of JSON Schema: objects must close their list of fields, and number bounds are
 * left to Plomb's own checks (which clamp every note anyway).
 */
export function toStructuredSchema(schema: object): Record<string, unknown> {
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(visit);
    if (!node || typeof node !== "object") return node;
    const entries = Object.entries(node as Record<string, unknown>).filter(([key]) => key !== "minimum" && key !== "maximum");
    const result = Object.fromEntries(entries.map(([key, value]) => [key, visit(value)]));
    if (result.type === "object") result.additionalProperties = false;
    return result;
  };
  return visit(schema) as Record<string, unknown>;
}

import { createJsonRedacteur, RedacteurError } from "./json-redacteur";
import { SYSTEM_PROMPT } from "./prompts";
import type { Redacteur } from "./types";

export const MISTRAL_API_URL = "https://api.mistral.ai/v1";
export const DEFAULT_MISTRAL_MODEL = "mistral-small-latest";

type Options = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  attempts?: number;
  /** Articles written at the same time (stays within the 5-minute limit of the online host). */
  parallel?: number;
  /** Tests: no real waiting between retries. */
  sleep?: (ms: number) => Promise<void>;
};

/** Editor in the cloud through Mistral's API (JSON mode): works even when the Mac is off. */
export function createMistralRedacteur({
  apiKey,
  model = DEFAULT_MISTRAL_MODEL,
  baseUrl = MISTRAL_API_URL,
  timeoutMs = 60_000,
  attempts = 3,
  parallel = 4,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: Options): Redacteur {
  if (!apiKey) throw new RedacteurError("Clé Mistral manquante (réglage MISTRAL_API_KEY).");

  return createJsonRedacteur({
    model,
    parallel,
    async ask(prompt) {
      let lastError = "";
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({
              model,
              temperature: 0.3,
              max_tokens: 1500,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
              ],
            }),
          });
          if (response.status === 401 || response.status === 403) {
            throw new RedacteurError("Le rédacteur n'a pas pu écrire : clé Mistral refusée (vérifiez MISTRAL_API_KEY).");
          }
          if (response.status === 429 || response.status >= 500) {
            // Too many requests at once, or Mistral busy: wait a little and try again.
            lastError = response.status === 429 ? "trop de demandes à la fois" : `Mistral a répondu ${response.status}`;
            await sleep(attempt * 2000);
            continue;
          }
          if (!response.ok) {
            lastError = `Mistral a répondu ${response.status}`;
            continue;
          }
          const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
          return JSON.parse(data.choices?.[0]?.message?.content ?? "");
        } catch (error) {
          if (error instanceof RedacteurError) throw error;
          lastError = error instanceof SyntaxError ? "réponse illisible" : "Mistral injoignable";
        }
      }
      throw new RedacteurError(`Le rédacteur n'a pas pu écrire : ${lastError}.`);
    },
  });
}

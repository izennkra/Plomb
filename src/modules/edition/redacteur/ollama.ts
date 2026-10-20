import { SYSTEM_PROMPT } from "./prompts";
import { createJsonRedacteur, RedacteurError } from "./json-redacteur";
import type { Redacteur } from "./types";

export { RedacteurError } from "./json-redacteur";

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

type Options = {
  model: string;
  baseUrl?: string;
  /** A long article on a busy Mac can take a while. */
  timeoutMs?: number;
  attempts?: number;
};

/** Editor running on the Mac through Ollama (development). One article at a time: the Mac stays usable. */
export function createOllamaRedacteur({
  model,
  baseUrl = DEFAULT_OLLAMA_URL,
  timeoutMs = 180_000,
  attempts = 2,
}: Options): Redacteur {
  return createJsonRedacteur({
    model,
    parallel: 1,
    attempts,
    async ask(prompt, schema) {
      let lastError = "";
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const response = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            signal: AbortSignal.timeout(timeoutMs),
            body: JSON.stringify({
              model,
              stream: false,
              think: false,
              format: schema,
              // Free the Mac's memory soon after the edition is written.
              keep_alive: "30s",
              options: { temperature: 0.3, num_ctx: 8192 },
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
              ],
            }),
          });
          if (!response.ok) {
            lastError = `l'IA a répondu ${response.status}`;
            continue;
          }
          const data = (await response.json()) as { message?: { content?: string } };
          return JSON.parse(data.message?.content ?? "");
        } catch (error) {
          lastError = error instanceof SyntaxError ? "réponse illisible" : "IA injoignable (Ollama est-il lancé ?)";
        }
      }
      throw new RedacteurError(`Le rédacteur n'a pas pu écrire : ${lastError}.`);
    },
  });
}

import { DEFAULT_MISTRAL_MODEL, createMistralRedacteur } from "./mistral";
import { createOllamaRedacteur } from "./ollama";
import type { Redacteur } from "./types";

/** Local AI for development on the Mac (comparison in docs/comparatif-ia.md). */
export const DEFAULT_OLLAMA_MODEL = "ministral-3:14b";

/**
 * The editor in use, chosen by settings: Mistral online (PLOMB_AI_PROVIDER=mistral + MISTRAL_API_KEY) — the one used
 * online — or Ollama on the Mac (default, development).
 */
export function getRedacteur(): Redacteur {
  if (process.env.PLOMB_AI_PROVIDER === "mistral") {
    return createMistralRedacteur({
      apiKey: process.env.MISTRAL_API_KEY ?? "",
      model: process.env.PLOMB_AI_MODEL ?? DEFAULT_MISTRAL_MODEL,
    });
  }
  return createOllamaRedacteur({
    model: process.env.PLOMB_AI_MODEL ?? DEFAULT_OLLAMA_MODEL,
    baseUrl: process.env.OLLAMA_URL,
  });
}

export type { Redacteur } from "./types";

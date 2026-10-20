import { createClaudeRedacteur, DEFAULT_CLAUDE_MODEL } from "./claude";
import { DEFAULT_MISTRAL_MODEL, createMistralRedacteur } from "./mistral";
import { createOllamaRedacteur } from "./ollama";
import type { Redacteur } from "./types";

/** Local AI for development on the Mac (comparison in docs/comparatif-ia.md). */
export const DEFAULT_OLLAMA_MODEL = "ministral-3:14b";

/**
 * The editor in use, chosen by settings (PLOMB_AI_PROVIDER):
 * - "claude": Claude's API (ANTHROPIC_API_KEY) — the one used online, model Claude Haiku 5.5;
 * - "mistral": Mistral's API (MISTRAL_API_KEY);
 * - otherwise Ollama on the Mac (development).
 */
export function getRedacteur(): Redacteur {
  switch (process.env.PLOMB_AI_PROVIDER) {
    case "claude":
      return createClaudeRedacteur({
        apiKey: process.env.ANTHROPIC_API_KEY ?? "",
        model: process.env.PLOMB_AI_MODEL ?? DEFAULT_CLAUDE_MODEL,
      });
    case "mistral":
      return createMistralRedacteur({
        apiKey: process.env.MISTRAL_API_KEY ?? "",
        model: process.env.PLOMB_AI_MODEL ?? DEFAULT_MISTRAL_MODEL,
      });
    default:
      return createOllamaRedacteur({
        model: process.env.PLOMB_AI_MODEL ?? DEFAULT_OLLAMA_MODEL,
        baseUrl: process.env.OLLAMA_URL,
      });
  }
}

export type { Redacteur } from "./types";

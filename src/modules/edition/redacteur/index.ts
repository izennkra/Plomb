import { createOllamaRedacteur } from "./ollama";
import type { Redacteur } from "./types";

/** The AI chosen for the editor-in-chief (comparison in docs/comparatif-ia.md). Can be changed in .env.local. */
export const DEFAULT_MODEL = "ministral-3:14b";

export function getRedacteur(): Redacteur {
  return createOllamaRedacteur({
    model: process.env.PLOMB_AI_MODEL ?? DEFAULT_MODEL,
    baseUrl: process.env.OLLAMA_URL,
  });
}

export type { Redacteur } from "./types";

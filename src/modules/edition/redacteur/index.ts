import { createClaudeRedacteur, DEFAULT_CLAUDE_MODEL } from "./claude";
import type { Redacteur } from "./types";

/** The editor-in-chief: Claude's API (ANTHROPIC_API_KEY), model Claude Haiku 5.5 unless PLOMB_AI_MODEL says otherwise. */
export function getRedacteur(): Redacteur {
  return createClaudeRedacteur({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.PLOMB_AI_MODEL ?? DEFAULT_CLAUDE_MODEL,
  });
}

export type { Redacteur } from "./types";

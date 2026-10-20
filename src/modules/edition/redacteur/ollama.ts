import { THEMES } from "@/db/schema";
import { LEAD_SCHEMA, leadPrompt, SUMMARY_SCHEMA, summaryPrompt, SYSTEM_PROMPT } from "./prompts";
import type { ArticleSummary, Redacteur, Theme } from "./types";

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

type Options = {
  model: string;
  baseUrl?: string;
  /** A long article on a busy Mac can take a while. */
  timeoutMs?: number;
  attempts?: number;
};

export class RedacteurError extends Error {}

/** Editor running on the Mac through Ollama. Answers are requested as JSON and checked. */
export function createOllamaRedacteur({
  model,
  baseUrl = DEFAULT_OLLAMA_URL,
  timeoutMs = 180_000,
  attempts = 2,
}: Options): Redacteur {
  async function ask(prompt: string, schema: object): Promise<unknown> {
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
  }

  return {
    model,
    async summarize(article) {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        const summary = toSummary(await ask(summaryPrompt(article), SUMMARY_SCHEMA));
        if (summary) return summary;
      }
      throw new RedacteurError("Le rédacteur n'a pas pu écrire : réponse incomplète.");
    },
    async writeLead(article) {
      const answer = (await ask(leadPrompt(article), LEAD_SCHEMA)) as { texte?: unknown };
      const text = typeof answer?.texte === "string" ? answer.texte.trim() : "";
      if (!text) throw new RedacteurError("Le rédacteur n'a pas pu écrire : texte de Une vide.");
      return text;
    },
  };
}

/** Checks an answer: every field present and sensible, or null. */
function toSummary(answer: unknown): ArticleSummary | null {
  if (!answer || typeof answer !== "object") return null;
  const { titre, resume, theme, importance } = answer as Record<string, unknown>;
  if (typeof titre !== "string" || !titre.trim() || typeof resume !== "string" || !resume.trim()) return null;
  if (!THEMES.includes(theme as Theme)) return null;
  const note = Math.round(Number(importance));
  if (!Number.isFinite(note)) return null;
  return {
    title: titre.trim(),
    summary: resume.trim(),
    theme: theme as Theme,
    importance: Math.min(10, Math.max(1, note)),
  };
}

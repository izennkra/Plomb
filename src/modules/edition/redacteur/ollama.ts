import { THEMES } from "@/db/schema";
import { importanceOf } from "../scoring";
import { FRONT_PAGE_SCHEMA, frontPagePrompt, LEAD_SCHEMA, leadPrompt, SUMMARY_SCHEMA, summaryPrompt, SYSTEM_PROMPT } from "./prompts";
import type { ArticleSummary, FrontPageChoice, Redacteur, Theme } from "./types";

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
    async chooseFrontPage(candidates) {
      const answer = await ask(frontPagePrompt(candidates), FRONT_PAGE_SCHEMA);
      const choice = toFrontPageChoice(answer, candidates.length);
      if (!choice) throw new RedacteurError("Le rédacteur n'a pas pu choisir la Une : réponse incohérente.");
      return choice;
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
  const { titre, resume, theme, sujet, notoriete, ampleur, auteurs, portee, qualite } = answer as Record<string, unknown>;
  if (typeof titre !== "string" || !titre.trim() || typeof resume !== "string" || !resume.trim()) return null;
  if (!THEMES.includes(theme as Theme)) return null;

  const notes = [notoriete, ampleur, auteurs, portee, qualite].map((value) => Math.round(Number(value)));
  if (notes.some((note) => !Number.isFinite(note))) return null;
  const [notoriety, scale, authors, reach, quality] = notes.map((note) => Math.min(5, Math.max(1, note)));
  const criteria = { notoriety, scale, authors, reach, quality };
  return {
    title: titre.trim(),
    summary: resume.trim(),
    theme: theme as Theme,
    subject: typeof sujet === "string" ? sujet.trim() : "",
    criteria,
    importance: importanceOf(criteria),
  };
}

/** The meeting's answer uses numbers from 1; checks they exist and differ. */
function toFrontPageChoice(answer: unknown, count: number): FrontPageChoice | null {
  if (!answer || typeof answer !== "object") return null;
  const { une, secondaires } = answer as Record<string, unknown>;
  const picks = [une, ...(Array.isArray(secondaires) ? secondaires : [])].map(Number);
  const wanted = Math.min(3, count);
  if (picks.length < wanted) return null;
  const chosen = picks.slice(0, wanted);
  if (chosen.some((pick) => !Number.isInteger(pick) || pick < 1 || pick > count)) return null;
  if (new Set(chosen).size !== chosen.length) return null;
  const [first, ...rest] = chosen.map((pick) => pick - 1);
  return { une: first, secondary: rest };
}

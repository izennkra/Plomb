import { THEMES } from "@/db/schema";
import { importanceOf } from "../scoring";
import { FRONT_PAGE_SCHEMA, frontPagePrompt, LEAD_SCHEMA, leadPrompt, SUMMARY_SCHEMA, summaryPrompt } from "./prompts";
import type { ArticleSummary, FrontPageChoice, Redacteur, Theme } from "./types";

export class RedacteurError extends Error {}

/**
 * The AI cannot work at all (key refused, no credit left…): retrying article by article is useless, the whole
 * preparation stops so that the reader is alerted.
 */
export class FatalRedacteurError extends RedacteurError {}

/** Sends one prompt to an AI and returns its JSON answer (already parsed). Throws RedacteurError when it can't. */
export type AskJson = (prompt: string, schema: object) => Promise<unknown>;

/**
 * The editor's work, whatever the AI behind it (Ollama on the Mac, Mistral online…): same instructions,
 * answers checked field by field, a second try when an answer is incomplete.
 */
export function createJsonRedacteur({
  model,
  parallel,
  attempts = 2,
  ask,
}: {
  model: string;
  parallel: number;
  attempts?: number;
  ask: AskJson;
}): Redacteur {
  return {
    model,
    parallel,
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

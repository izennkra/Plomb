import type { ArticleInput, ArticleSummary, Redacteur } from "@/modules/edition/redacteur/types";
import { importanceOf, type Criteria } from "@/modules/edition/scoring";

const all = (value: number): Criteria => ({ notoriety: value, scale: value, authors: value, reach: value, quality: value });

/**
 * Editor with fixed answers, per original title: importance level (1–5 on every criterion, default 3), subject
 * (default: the title), titles on which it fails. Records which articles got a Une text.
 */
export function createFakeRedacteur({
  importance = {},
  subjects = {},
  failsOn = [],
}: { importance?: Record<string, number>; subjects?: Record<string, string>; failsOn?: string[] } = {}) {
  const leads: string[] = [];
  const redacteur: Redacteur = {
    model: "fake",
    async summarize(article: ArticleInput): Promise<ArticleSummary> {
      if (failsOn.includes(article.title)) throw new Error("AI failed");
      const criteria = all(importance[article.title] ?? 3);
      return {
        title: `FR ${article.title}`,
        summary: `Résumé de ${article.title}`,
        theme: "Identité",
        subject: subjects[article.title] ?? article.title,
        criteria,
        importance: importanceOf(criteria),
      };
    },
    async writeLead(article: ArticleInput): Promise<string> {
      leads.push(article.title);
      return `Une de ${article.title}`;
    },
  };
  return { redacteur, leads };
}

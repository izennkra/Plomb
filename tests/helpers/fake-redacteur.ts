import type { ArticleInput, ArticleSummary, Redacteur } from "@/modules/edition/redacteur/types";

/**
 * Editor with fixed answers: importance per original title (default 5), and titles on which it fails.
 * Records which articles got a Une text.
 */
export function createFakeRedacteur({
  importance = {},
  failsOn = [],
}: { importance?: Record<string, number>; failsOn?: string[] } = {}) {
  const leads: string[] = [];
  const redacteur: Redacteur = {
    model: "fake",
    async summarize(article: ArticleInput): Promise<ArticleSummary> {
      if (failsOn.includes(article.title)) throw new Error("AI failed");
      return {
        title: `FR ${article.title}`,
        summary: `Résumé de ${article.title}`,
        theme: "Identité",
        importance: importance[article.title] ?? 5,
      };
    },
    async writeLead(article: ArticleInput): Promise<string> {
      leads.push(article.title);
      return `Une de ${article.title}`;
    },
  };
  return { redacteur, leads };
}

import type { ArticleInput, ArticleSummary, FrontPageCandidate, Redacteur } from "@/modules/edition/redacteur/types";
import { importanceOf, type Criteria } from "@/modules/edition/scoring";

const all = (value: number): Criteria => ({ notoriety: value, scale: value, authors: value, reach: value, quality: value });

/**
 * Editor with fixed answers, per original title: importance level (1–5 on every criterion, default 3), subject
 * (default: the title), titles on which it fails, and the editorial meeting's pick (original titles; none = it fails,
 * so the Une follows the notes). Records which articles got a Une text and what the meeting saw.
 */
export function createFakeRedacteur({
  importance = {},
  subjects = {},
  failsOn = [],
  frontPage,
}: {
  importance?: Record<string, number>;
  subjects?: Record<string, string>;
  failsOn?: string[];
  frontPage?: { une: string; secondary: string[] };
} = {}) {
  const leads: string[] = [];
  const meetings: FrontPageCandidate[][] = [];
  const redacteur: Redacteur = {
    model: "fake",
    parallel: 3,
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
    async chooseFrontPage(candidates: FrontPageCandidate[]) {
      meetings.push(candidates);
      if (!frontPage) throw new Error("no meeting");
      const at = (title: string) => candidates.findIndex((candidate) => candidate.title === `FR ${title}`);
      return { une: at(frontPage.une), secondary: frontPage.secondary.map(at) };
    },
  };
  return { redacteur, leads, meetings };
}

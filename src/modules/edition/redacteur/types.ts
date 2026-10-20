import type { THEMES } from "@/db/schema";

export type Theme = (typeof THEMES)[number];

/** What the editor reads: the article as found on the media's site. */
export type ArticleInput = {
  title: string;
  content: string | null;
  excerpt: string | null;
  sourceName: string;
};

/** What the editor writes for every article of the edition. */
export type ArticleSummary = {
  title: string;
  summary: string;
  theme: Theme;
  /** Interest for a designer, 1 to 10. */
  importance: number;
};

/** The AI editor-in-chief. Interchangeable: local AI today, something else once Plomb is online. */
export interface Redacteur {
  readonly model: string;
  summarize(article: ArticleInput): Promise<ArticleSummary>;
  /** Longer text for the 3 articles of the Une (~120 words). */
  writeLead(article: ArticleInput): Promise<string>;
}

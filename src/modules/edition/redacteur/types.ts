import type { THEMES } from "@/db/schema";
import type { Criteria } from "../scoring";

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
  /** Main subject (brand, institution, studio…), e.g. "Coca-Cola": the same story covered by several media is merged. */
  subject: string;
  /** What makes it front-page material, each from 1 to 5. */
  criteria: Criteria;
  /** Importance out of 10, computed from the criteria. */
  importance: number;
};

/** A story competing for the Une, as seen in the editorial meeting. */
export type FrontPageCandidate = {
  title: string;
  summary: string;
  subject: string;
  sourceName: string;
  coveredBy: string[];
  importance: number;
};

/** The editorial meeting's choice: positions in the candidates list (0-based). */
export type FrontPageChoice = { une: number; secondary: number[] };

/** The AI editor-in-chief. Interchangeable: local AI today, something else once Plomb is online. */
export interface Redacteur {
  readonly model: string;
  /** How many articles it can write at the same time (1 on the Mac, more online). */
  readonly parallel: number;
  summarize(article: ArticleInput): Promise<ArticleSummary>;
  /** Longer text for the 3 articles of the Une (~120 words). */
  writeLead(article: ArticleInput): Promise<string>;
  /** Editorial meeting: compares the best candidates side by side and picks the Une (1 major + 2 secondary). */
  chooseFrontPage(candidates: FrontPageCandidate[]): Promise<FrontPageChoice>;
}

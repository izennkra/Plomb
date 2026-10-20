/** What makes an article front-page material, each judged by the editor from 1 to 5. */
export type Criteria = {
  /** Global brand or institution (5) … neighbourhood shop (1). */
  notoriety: number;
  /** Complete identity overhaul (5) … small detail (1). */
  scale: number;
  /** Renowned studio or agency (5) … unknown (1). */
  authors: number;
  /** Sparks debate, changes practices (5) … no echo (1). */
  reach: number;
  /** Quality and originality of the work. */
  quality: number;
};

/** Notoriety and scale weigh the most: a Coca-Cola rebrand beats a local café's, however nice. */
export const WEIGHTS: Criteria = { notoriety: 3, scale: 2.5, reach: 2, authors: 1.5, quality: 1 };

/** Each other media covering the same subject adds this (a sign of a big story), up to 2 points. */
export const ECHO_BONUS = 1;
const MAX_ECHO_BONUS = 2;

/** Importance out of 10 (with decimals, to rank finely). */
export function importanceOf(criteria: Criteria, otherMedia = 0): number {
  const total = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const average = (Object.keys(WEIGHTS) as (keyof Criteria)[]).reduce(
    (sum, key) => sum + WEIGHTS[key] * clamp(criteria[key]),
    0,
  ) / total;
  const base = 1 + ((average - 1) / 4) * 9; // 1–5 → 1–10
  return Math.min(10, base + Math.min(MAX_ECHO_BONUS, otherMedia * ECHO_BONUS));
}

function clamp(value: number): number {
  return Number.isFinite(value) ? Math.min(5, Math.max(1, value)) : 1;
}

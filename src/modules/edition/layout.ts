/**
 * Where each window of the journal sits on its 12-column grid (desktop), after the orange Une (columns 1 to 7):
 * the first secondary article large on the right, then a rhythm of narrow and wide windows, as on Izenn's
 * reference. Each window then rises as high as its columns allow.
 */
export type Slot = { column: number; span: 3 | 6 | 9 };

/** First window: the main secondary article, columns 4 to 12, under the Une. */
const FIRST: Slot = { column: 4, span: 9 };
/** Then this rhythm, repeated. */
const RHYTHM: Slot[] = [
  { column: 1, span: 3 },
  { column: 4, span: 3 },
  { column: 7, span: 6 },
  { column: 1, span: 6 },
  { column: 7, span: 3 },
  { column: 10, span: 3 },
];

export function windowSlots(count: number): Slot[] {
  return Array.from({ length: count }, (_, index) => (index === 0 ? FIRST : RHYTHM[(index - 1) % RHYTHM.length]));
}

/** Shape of a window's picture: tall when narrow, wide when large. */
export function imageRatio(span: Slot["span"]): string {
  if (span === 3) return "3 / 4";
  if (span === 6) return "5 / 4";
  return "16 / 9";
}

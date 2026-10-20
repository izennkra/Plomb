/** The Salle de Dépêches shows (and Plomb keeps) one week of publications. */
export const FEED_DAYS = 7;

/**
 * Articles found by the first relève of a source (already published before the subscription) are shown only when
 * recent. Product rule: 3 days. During the test phase: 7 days, to have material (Izenn, 2026-10-20).
 */
export const BACKFILL_MAX_AGE_DAYS = 7;

export const DAY_MS = 24 * 60 * 60 * 1000;

import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editions, sources, users } from "@/db/schema";
import { FEED_SOURCE_TYPES, refreshSource } from "@/modules/aspiration-web/refresh-source";
import { purgeOldPosts } from "@/modules/depeches/purge";
import { buildEdition } from "@/modules/edition/build";
import { renderEditionEmail } from "@/modules/edition/email";
import { getEditionItems, isBuilding } from "@/modules/edition/list";
import { parisDay, parisTime } from "@/modules/edition/paris-time";
import type { Redacteur } from "@/modules/edition/redacteur/types";
import { isEditionDay, toSchedule } from "@/modules/edition/schedule";
import { mapInParallel } from "@/modules/edition/parallel";
import type { PageFetcher } from "@/modules/fetching/polite-fetch";
import { renderAlertEmail } from "./alert-email";
import type { SendEmail } from "./email-sender";

/** 8:00 the edition is prepared, 9:00 it is published and e-mailed (Paris time). */
export const PREPARE_HOUR = 8;
export const PUBLISH_HOUR = 9;
/** If the journal still could not be prepared at 9:30, the reader is told. */
const ALERT_DELAY_MS = 30 * 60_000;
const MAX_ATTEMPTS = 3;
/** A preparation started more than this ago was cut off (5-minute limit online): it is started again. */
const STALE_BUILD_MS = 10 * 60_000;
/** Each source is read again after this. */
export const REFRESH_EVERY_MS = 30 * 60_000;
/** Sources read at the same time (each site still at its own polite pace). */
const PARALLEL_SOURCES = 4;
/** No new source is started when less than this is left in the call's time budget. */
const SOURCE_RESERVE_MS = 75_000;

export type ClockDeps = {
  redacteur: () => Redacteur;
  sendEmail: SendEmail;
  /** Where the e-mails go (one reader for now; accounts come with brick 7). */
  emailTo: string;
  journalUrl: string;
  fetchPage?: () => PageFetcher;
  now?: () => Date;
  /** Time this call may use (the online host stops calls after 5 minutes). */
  budgetMs?: number;
  /** Real elapsed time since the start of the call (tests can fake it). */
  elapsedMs?: () => number;
};

export type ClockReport = {
  edition: "prepared" | "failed" | "none";
  emailsSent: number;
  alertsSent: number;
  /** E-mails that could not leave: retried at the next call. */
  emailErrors: string[];
  sourcesRefreshed: number;
};

/**
 * Called every 15 minutes by the online clock. Does what is due, catches up on what was missed, never twice:
 * 1. the edition of the day (from 8:00 on publication days), 2. its e-mail (from 9:00), 3. an alert if it failed
 * (from 9:30), 4. then the relève of the sources with the time left.
 */
export async function runClock(db: Db, deps: ClockDeps): Promise<ClockReport> {
  const started = Date.now();
  const elapsed = deps.elapsedMs ?? (() => Date.now() - started);
  const now = deps.now ?? (() => new Date());
  const budget = deps.budgetMs ?? 240_000;
  const report: ClockReport = { edition: "none", emailsSent: 0, alertsSent: 0, emailErrors: [], sourcesRefreshed: 0 };

  for (const user of await db.select().from(users)) {
    await editionOfTheDay(db, user, deps, now(), report);
  }

  report.sourcesRefreshed = await refreshDueSources(db, {
    now: now(),
    fetchPage: deps.fetchPage,
    timeLeft: () => budget - elapsed(),
  });
  await purgeOldPosts(db, now());
  return report;
}

async function editionOfTheDay(
  db: Db,
  user: typeof users.$inferSelect,
  deps: ClockDeps,
  now: Date,
  report: ClockReport,
): Promise<void> {
  const day = parisDay(now);
  const prepareAt = parisTime(day, PREPARE_HOUR);
  const publishAt = parisTime(day, PUBLISH_HOUR);
  if (now < prepareAt) return;

  const schedule = toSchedule(user.editionFrequency, user.editionWeekdays);
  const previous = await db.query.editions.findFirst({
    where: and(eq(editions.userId, user.id), eq(editions.status, "ready"), lt(editions.day, day)),
    orderBy: sql`${editions.day} desc`,
  });
  let edition = await db.query.editions.findFirst({ where: and(eq(editions.userId, user.id), eq(editions.day, day)) });
  if (!edition && !isEditionDay(schedule, day, previous?.day)) return;

  // 1. Prepare (or try again) the edition of the day.
  const needsBuild =
    !edition ||
    (edition.status === "error" && edition.attempts < MAX_ATTEMPTS) ||
    (edition.status === "building" && !isBuilding(edition, now.getTime(), STALE_BUILD_MS) && edition.attempts < MAX_ATTEMPTS);
  if (needsBuild) {
    let redacteur: Redacteur | null = null;
    try {
      redacteur = deps.redacteur();
    } catch (error) {
      // The AI cannot even start (missing key…): counts as an attempt, with its reason.
      report.edition = "failed";
      edition = await recordFailure(db, user.id, day, publishAt, error);
    }
    if (redacteur) {
      try {
        edition = await buildEdition(db, user.id, { redacteur, now, publishAt });
        report.edition = "prepared";
      } catch {
        // The preparation itself failed: it already marked the edition (attempt and reason).
        report.edition = "failed";
        edition = await db.query.editions.findFirst({ where: and(eq(editions.userId, user.id), eq(editions.day, day)) });
      }
    }
  }
  if (!edition) return;

  // 2. From 9:00: the e-mail of the automatic edition, once (an edition prepared by hand sends none).
  if (edition.status === "ready" && edition.publishAt && now >= publishAt && !edition.emailSentAt) {
    const items = await getEditionItems(db, edition.id);
    const email = renderEditionEmail(edition, items, { journalUrl: `${deps.journalUrl}?edition=${edition.id}` });
    try {
      await deps.sendEmail({ to: deps.emailTo, ...email });
      await db.update(editions).set({ emailSentAt: now }).where(eq(editions.id, edition.id));
      report.emailsSent++;
    } catch (error) {
      report.emailErrors.push(error instanceof Error ? error.message : "envoi impossible");
    }
  }

  // 3. From 9:30, if it still could not be prepared: tell the reader, once.
  const gaveUp = edition.status !== "ready" && edition.attempts >= MAX_ATTEMPTS && !isBuilding(edition, now.getTime(), STALE_BUILD_MS);
  if (gaveUp && now.getTime() >= publishAt.getTime() + ALERT_DELAY_MS && !edition.alertSentAt) {
    try {
      await deps.sendEmail(
        renderAlertEmail(day, edition.message ?? "préparation interrompue", { to: deps.emailTo, journalUrl: deps.journalUrl }),
      );
      await db.update(editions).set({ alertSentAt: now }).where(eq(editions.id, edition.id));
      report.alertsSent++;
    } catch (error) {
      report.emailErrors.push(error instanceof Error ? error.message : "envoi impossible");
    }
  }
}

/** Keeps track of a preparation that could not even start (AI unusable), with its reason: one more attempt. */
async function recordFailure(db: Db, userId: string, day: string, publishAt: Date, error: unknown) {
  const reason = error instanceof Error ? error.message : "erreur inconnue";
  const existing = await db.query.editions.findFirst({ where: and(eq(editions.userId, userId), eq(editions.day, day)) });
  if (existing) {
    const [updated] = await db
      .update(editions)
      .set({ status: "error", message: reason, attempts: existing.attempts + 1 })
      .where(eq(editions.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(editions)
    .values({ userId, day, periodStart: publishAt, periodEnd: publishAt, publishAt, status: "error", message: reason, attempts: 1 })
    .returning();
  return created;
}

/** Reads the sources not read for 30 minutes, the oldest first, while there is time left. */
async function refreshDueSources(
  db: Db,
  { now, fetchPage, timeLeft }: { now: Date; fetchPage?: () => PageFetcher; timeLeft: () => number },
): Promise<number> {
  const dueBefore = new Date(now.getTime() - REFRESH_EVERY_MS);
  const due = await db
    .select({ id: sources.id })
    .from(sources)
    .where(
      and(inArray(sources.type, FEED_SOURCE_TYPES), or(isNull(sources.lastFetchedAt), lt(sources.lastFetchedAt, dueBefore))),
    )
    .orderBy(asc(sql`coalesce(${sources.lastFetchedAt}, 0)`));

  const fetcher = fetchPage?.();
  let refreshed = 0;
  await mapInParallel(due, PARALLEL_SOURCES, async ({ id }) => {
    if (timeLeft() < SOURCE_RESERVE_MS) return;
    await refreshSource(db, id, fetcher ? { fetchPage: fetcher } : {}).catch(() => null);
    refreshed++;
  });
  return refreshed;
}

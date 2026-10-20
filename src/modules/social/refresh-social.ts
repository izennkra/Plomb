import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { socialRuns, sources, type Source } from "@/db/schema";
import { newArticlesMessage, newOnes, store } from "@/modules/aspiration-web/refresh-source";
import { parisDay, parisTime } from "@/modules/edition/paris-time";
import { isFinished, type ApifyClient } from "./apify";
import { copyImages, type DownloadImage } from "./copy-images";
import type { MediaStore } from "./media-store";
import { platformOf } from "./platforms";

export const SOCIAL_TYPES: Source["type"][] = ["instagram", "x", "linkedin"];
/** Four times a day (Paris): 7:30, in time for the 8:00 edition, then 11:30, 15:30 and 19:30. */
export const SOCIAL_HOURS = [7.5, 11.5, 15.5, 19.5];
/** No new request to Apify past this spending in the month (the free plan gives 5 $). */
export const MONTHLY_BUDGET_USD = 4;
/** A request still running after this is considered lost. */
const RUN_TIMEOUT_MS = 2 * 60 * 60 * 1000;
/** Their images expire after a few days: they are copied. (X images last.) */
const COPY_IMAGES_FOR: Source["type"][] = ["instagram", "linkedin"];

/** Start of the current window (the last check time passed, or yesterday's last one in the early morning). */
export function socialWindowStart(now: Date): Date {
  const today = parisDay(now);
  const at = (day: string, hour: number) => new Date(parisTime(day, Math.floor(hour)).getTime() + (hour % 1) * 3_600_000);
  const candidates = SOCIAL_HOURS.map((hour) => at(today, hour)).filter((time) => time <= now);
  if (candidates.length > 0) return candidates[candidates.length - 1];
  const yesterday = parisDay(new Date(now.getTime() - 24 * 3_600_000));
  return at(yesterday, SOCIAL_HOURS[SOCIAL_HOURS.length - 1]);
}

/**
 * Sends the requests of the social sources due: not asked since the start of the current window (or all of them
 * with `force`, from the "Relever maintenant" button). Stops when the month's free credit is nearly used.
 */
export async function launchSocialRuns(
  db: Db,
  { apify, now = new Date(), force = false }: { apify: ApifyClient; now?: Date; force?: boolean },
): Promise<{ launched: number; skipped?: string }> {
  const social = await db.select().from(sources).where(inArray(sources.type, SOCIAL_TYPES));
  if (social.length === 0) return { launched: 0 };

  const running = new Set(
    (await db.select({ sourceId: socialRuns.sourceId }).from(socialRuns).where(eq(socialRuns.status, "running"))).map(
      (run) => run.sourceId,
    ),
  );
  const windowStart = socialWindowStart(now);
  const due = social.filter(
    (source) => !running.has(source.id) && (force || !source.lastFetchedAt || source.lastFetchedAt < windowStart),
  );
  if (due.length === 0) return { launched: 0 };

  if ((await apify.monthlyUsageUsd()) >= MONTHLY_BUDGET_USD) {
    const message = "Crédit gratuit Apify du mois presque épuisé : réseaux sociaux en pause jusqu'au mois prochain.";
    await db.update(sources).set({ lastFetchStatus: "error", lastFetchMessage: message, lastFetchedAt: now }).where(
      inArray(
        sources.id,
        due.map((source) => source.id),
      ),
    );
    return { launched: 0, skipped: message };
  }

  // One request per network for all its accounts (cheaper): accounts just added (a few recent posts) apart from
  // the others (posts newer than their oldest last successful request).
  const byActor = Map.groupBy(due, (source) => platformOf(source)?.actor ?? "");
  let launched = 0;
  for (const [actor, group] of byActor) {
    const platform = platformOf(group[0]);
    if (!actor || !platform) continue;
    const lastSuccess = new Map(await Promise.all(group.map(async (source) => [source.id, await lastSuccessfulRun(db, source.id)] as const)));
    const newcomers = group.filter((source) => !lastSuccess.get(source.id));
    const regulars = group.filter((source) => lastSuccess.get(source.id));
    const since = regulars.length
      ? new Date(Math.min(...regulars.map((source) => lastSuccess.get(source.id)!.getTime())))
      : null;

    for (const [batch, batchSince] of [
      [newcomers, null],
      [regulars, since],
    ] as const) {
      if (batch.length === 0) continue;
      try {
        const { runId, datasetId } = await apify.startRun(actor, platform.input(batch, batchSince));
        await db.insert(socialRuns).values(batch.map((source) => ({ sourceId: source.id, actor, runId, datasetId, startedAt: now })));
        await db
          .update(sources)
          .set({ lastFetchStatus: "running", lastFetchedAt: now })
          .where(inArray(sources.id, batch.map((source) => source.id)));
        launched += batch.length;
      } catch (error) {
        await db
          .update(sources)
          .set({ lastFetchStatus: "error", lastFetchMessage: error instanceof Error ? error.message : "Apify injoignable.", lastFetchedAt: now })
          .where(inArray(sources.id, batch.map((source) => source.id)));
      }
    }
  }
  return { launched };
}

/** Reads the results of the requests that finished, stores the new posts (with copies of their images). */
export async function collectSocialRuns(
  db: Db,
  {
    apify,
    mediaStore,
    now = new Date(),
    fetchImage,
  }: { apify: ApifyClient; mediaStore: MediaStore; now?: Date; fetchImage?: DownloadImage },
): Promise<{ collected: number; added: number }> {
  const running = await db.select().from(socialRuns).where(eq(socialRuns.status, "running"));
  let collected = 0;
  let added = 0;

  // A request serves several accounts: read its state and its answer once.
  for (const [runId, rows] of Map.groupBy(running, (run) => run.runId)) {
    let state;
    try {
      state = await apify.getRun(runId);
    } catch {
      continue; // try again at the next call
    }
    if (!isFinished(state.status)) {
      if (now.getTime() - rows[0].startedAt.getTime() > RUN_TIMEOUT_MS) {
        for (const run of rows) {
          await finish(db, run.id, "failed", "demande trop longue", now);
          await setStatus(db, run.sourceId, "error", "La demande à Apify n'a pas abouti. Nouvel essai au prochain relevé.", now);
        }
      }
      continue;
    }
    if (state.status !== "SUCCEEDED") {
      for (const run of rows) {
        await finish(db, run.id, "failed", state.status, now);
        await setStatus(db, run.sourceId, "error", "La demande à Apify a échoué. Nouvel essai au prochain relevé.", now);
      }
      continue;
    }

    const items = await apify.getItems(rows[0].datasetId);
    for (const run of rows) {
      const source = await db.query.sources.findFirst({ where: eq(sources.id, run.sourceId) });
      const platform = source ? platformOf(source) : null;
      if (!source || !platform) {
        await finish(db, run.id, "failed", "source retirée", now);
        continue;
      }
      const found = platform.read(items, source);
      const listed = found.map((post) => post.url);
      const handled = await newOnes(db, source.id, listed);
      const fresh = found.filter((post) => handled.includes(post.url));
      if (COPY_IMAGES_FOR.includes(source.type)) {
        for (const post of fresh) {
          post.images = await copyImages(post.images, mediaStore, fetchImage ? { fetchImage } : {});
          post.imageUrl = post.images[0] ?? post.imageUrl;
        }
      }
      const count = await store(db, source.id, { method: "social", listed, handled, posts: fresh });
      await finish(db, run.id, "done", null, now);
      await setStatus(db, source.id, "ok", newArticlesMessage(count), now);
      collected++;
      added += count;
    }
  }
  return { collected, added };
}

/** Requests finished more than 2 days ago are forgotten. */
export async function forgetOldRuns(db: Db, now = new Date()): Promise<void> {
  await db.delete(socialRuns).where(and(lt(socialRuns.startedAt, new Date(now.getTime() - 2 * 86_400_000))));
}

/** Posts are asked "newer than" the start of the last request that worked. */
async function lastSuccessfulRun(db: Db, sourceId: number): Promise<Date | null> {
  const last = await db.query.socialRuns.findFirst({
    where: and(eq(socialRuns.sourceId, sourceId), eq(socialRuns.status, "done")),
    orderBy: desc(socialRuns.startedAt),
  });
  return last?.startedAt ?? null;
}

async function finish(db: Db, id: number, status: "done" | "failed", message: string | null, now: Date) {
  await db.update(socialRuns).set({ status, message, finishedAt: now }).where(eq(socialRuns.id, id));
}

async function setStatus(db: Db, sourceId: number, status: "ok" | "error", message: string, now: Date) {
  await db.update(sources).set({ lastFetchStatus: status, lastFetchMessage: message, lastFetchedAt: now }).where(eq(sources.id, sourceId));
}

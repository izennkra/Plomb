import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editions, posts, sources, subscriptions } from "@/db/schema";
import { isDayOnly } from "@/modules/depeches/format-date";
import { parisDay, parisTime } from "./paris-time";

/** Articles arrived until 8:00 go into the 9:00 edition. */
export const EDITION_CUTOFF_HOUR = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
/** An article published just before the period but found a little late still makes it. */
const LATE_DISCOVERY_MARGIN_MS = 12 * 60 * 60 * 1000;

export type EditionPost = {
  postId: number;
  url: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  images: string[];
  sourceName: string;
  favorite: boolean;
};

export type EditionSelection = { day: string; periodStart: Date; periodEnd: Date; posts: EditionPost[] };

/** Test phase (PLOMB_EDITION_TEST=1 in .env.local): see `selectEditionPosts`. */
/** In test mode, an edition is limited so the Mac is not busy for an hour. */
export const TEST_MODE_MAX_POSTS = 10;
export const editionTestMode = () => process.env.PLOMB_EDITION_TEST === "1";

/**
 * Articles of the next edition: new ones (never those already there before the subscription) from the user's sources,
 * found since the previous edition and until 8:00 (Paris). First edition: the last 24 hours (or 3 days… per frequency).
 */
export async function selectEditionPosts(
  db: Db,
  userId: string,
  {
    now = new Date(),
    testMode = false,
    coverageDays = 1,
  }: { now?: Date; testMode?: boolean; /** First edition: how many days it covers (frequency). */ coverageDays?: number } = {},
): Promise<EditionSelection> {
  const day = parisDay(now);
  const cutoff = parisTime(day, EDITION_CUTOFF_HOUR);
  // Test mode: everything until now, including articles from before the subscription (to have material).
  const periodEnd = testMode || now < cutoff ? now : cutoff;

  const previous = await db.query.editions.findFirst({
    where: and(eq(editions.userId, userId), eq(editions.status, "ready"), lt(editions.day, day)),
    orderBy: desc(editions.day),
  });
  const periodStart = previous?.periodEnd ?? new Date(periodEnd.getTime() - coverageDays * DAY_MS);

  const rows = await db
    .select({
      postId: posts.id,
      url: posts.url,
      title: posts.title,
      excerpt: posts.excerpt,
      content: posts.content,
      images: posts.images,
      imageUrl: posts.imageUrl,
      publishedAt: posts.publishedAt,
      beforeSubscription: posts.beforeSubscription,
      sourceName: sources.displayName,
      favorite: subscriptions.favorite,
    })
    .from(posts)
    .innerJoin(sources, eq(posts.sourceId, sources.id))
    .innerJoin(subscriptions, eq(subscriptions.sourceId, sources.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        testMode ? undefined : eq(posts.beforeSubscription, false),
        gte(posts.discoveredAt, periodStart),
        lt(posts.discoveredAt, periodEnd),
      ),
    )
    .orderBy(desc(subscriptions.favorite), desc(posts.discoveredAt));

  // One article followed through two sources counts once (the favourite source wins: rows are sorted that way).
  const byUrl = new Map<string, EditionPost>();
  for (const { imageUrl, images, publishedAt, beforeSubscription, ...row } of rows) {
    if (!isRecent(publishedAt, beforeSubscription, periodStart)) continue;
    if (!byUrl.has(row.url)) byUrl.set(row.url, { ...row, images: images?.length ? images : imageUrl ? [imageUrl] : [] });
  }
  const selected = [...byUrl.values()];
  return { day, periodStart, periodEnd, posts: testMode ? takeInTurns(selected, TEST_MODE_MAX_POSTS) : selected };
}

/**
 * The journal is about what just happened. A dated article must have been published during the edition's period
 * (12 h margin for late discoveries): an old article that reappears on a site ("most read"…) is not news.
 * An undated article is only trusted when it appeared after the subscription.
 */
function isRecent(publishedAt: Date | null, beforeSubscription: boolean, periodStart: Date): boolean {
  if (!publishedAt) return !beforeSubscription;
  // Sites that only give the day (2026-10-20): the whole day counts.
  const latest = isDayOnly(publishedAt) ? publishedAt.getTime() + DAY_MS - 1 : publishedAt.getTime();
  return latest >= periodStart.getTime() - LATE_DISCOVERY_MARGIN_MS;
}

/** Test mode: one article of each source in turn, so a short test edition still mixes the media. */
function takeInTurns(posts: EditionPost[], max: number): EditionPost[] {
  const bySource = Map.groupBy(posts, (post) => post.sourceName);
  const taken: EditionPost[] = [];
  for (let round = 0; taken.length < max && taken.length < posts.length; round++) {
    for (const list of bySource.values()) {
      if (list[round] && taken.length < max) taken.push(list[round]);
    }
  }
  return taken;
}

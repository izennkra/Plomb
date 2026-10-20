import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editions, posts, sources, subscriptions } from "@/db/schema";
import { parisDay, parisTime } from "./paris-time";

/** Articles arrived until 8:00 go into the 9:00 edition. */
export const EDITION_CUTOFF_HOUR = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

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

/**
 * Articles of the next edition: new ones (never those already there before the subscription) from the user's sources,
 * found since the previous edition and until 8:00 (Paris). First edition: the last 24 hours.
 */
export async function selectEditionPosts(db: Db, userId: string, { now = new Date() } = {}): Promise<EditionSelection> {
  const day = parisDay(now);
  const cutoff = parisTime(day, EDITION_CUTOFF_HOUR);
  const periodEnd = now < cutoff ? now : cutoff;

  const previous = await db.query.editions.findFirst({
    where: and(eq(editions.userId, userId), eq(editions.status, "ready"), lt(editions.day, day)),
    orderBy: desc(editions.day),
  });
  const periodStart = previous?.periodEnd ?? new Date(periodEnd.getTime() - DAY_MS);

  const rows = await db
    .select({
      postId: posts.id,
      url: posts.url,
      title: posts.title,
      excerpt: posts.excerpt,
      content: posts.content,
      images: posts.images,
      imageUrl: posts.imageUrl,
      sourceName: sources.displayName,
      favorite: subscriptions.favorite,
    })
    .from(posts)
    .innerJoin(sources, eq(posts.sourceId, sources.id))
    .innerJoin(subscriptions, eq(subscriptions.sourceId, sources.id))
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(posts.beforeSubscription, false),
        gte(posts.discoveredAt, periodStart),
        lt(posts.discoveredAt, periodEnd),
      ),
    )
    .orderBy(desc(subscriptions.favorite), desc(posts.discoveredAt));

  // One article followed through two sources counts once (the favourite source wins: rows are sorted that way).
  const byUrl = new Map<string, EditionPost>();
  for (const { imageUrl, images, ...row } of rows) {
    if (!byUrl.has(row.url)) byUrl.set(row.url, { ...row, images: images?.length ? images : imageUrl ? [imageUrl] : [] });
  }
  return { day, periodStart, periodEnd, posts: [...byUrl.values()] };
}

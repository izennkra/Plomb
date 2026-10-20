import { inArray, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editions, posts, seenLinks } from "@/db/schema";
import { parisDay } from "@/modules/edition/paris-time";
import { DAY_MS, FEED_DAYS } from "./settings";

/**
 * Plomb keeps one week of publications. Older ones are deleted, but their address stays "already seen"
 * so they never come back as news. (Later: saved articles will be kept.)
 */
export async function purgeOldPosts(
  db: Db,
  now = new Date(),
  { mediaStore }: { mediaStore?: { remove(urls: string[]): Promise<void> } } = {},
): Promise<number> {
  // Editions of more than a week ago go too (their articles keep a copy, but nobody reads them anymore).
  await db.delete(editions).where(lt(editions.day, parisDay(new Date(now.getTime() - FEED_DAYS * DAY_MS))));

  const limit = Math.floor((now.getTime() - FEED_DAYS * DAY_MS) / 1000);
  const old = await db
    .select({ id: posts.id, sourceId: posts.sourceId, url: posts.url, images: posts.images })
    .from(posts)
    .where(sql`coalesce(${posts.publishedAt}, ${posts.discoveredAt}) < ${limit}`);
  if (old.length === 0) return 0;

  await db
    .insert(seenLinks)
    .values(old.map(({ sourceId, url }) => ({ sourceId, url })))
    .onConflictDoNothing();
  // Copies of social images go with their posts.
  await mediaStore?.remove(old.flatMap((post) => post.images ?? [])).catch(() => {});
  await db.delete(posts).where(
    inArray(
      posts.id,
      old.map((post) => post.id),
    ),
  );
  return old.length;
}

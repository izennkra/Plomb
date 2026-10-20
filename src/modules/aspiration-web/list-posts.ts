import { count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { posts, type Post } from "@/db/schema";

export type PostSummary = Pick<
  Post,
  "id" | "sourceId" | "url" | "title" | "excerpt" | "imageUrl" | "publishedAt" | "discoveredAt" | "beforeSubscription"
>;

/** Most recent articles of each source (publication date, or discovery date when unknown), and totals. */
export async function listRecentPosts(
  db: Db,
  sourceIds: number[],
  perSource = 5,
): Promise<Map<number, { total: number; recent: PostSummary[] }>> {
  const result = new Map<number, { total: number; recent: PostSummary[] }>();
  if (sourceIds.length === 0) return result;

  const totals = await db
    .select({ sourceId: posts.sourceId, total: count() })
    .from(posts)
    .where(inArray(posts.sourceId, sourceIds))
    .groupBy(posts.sourceId);
  const totalBySource = new Map(totals.map((row) => [row.sourceId, row.total]));

  for (const sourceId of sourceIds) {
    const recent = await db
      .select({
        id: posts.id,
        sourceId: posts.sourceId,
        url: posts.url,
        title: posts.title,
        excerpt: posts.excerpt,
        imageUrl: posts.imageUrl,
        publishedAt: posts.publishedAt,
        discoveredAt: posts.discoveredAt,
        beforeSubscription: posts.beforeSubscription,
      })
      .from(posts)
      .where(eq(posts.sourceId, sourceId))
      .orderBy(desc(sql`coalesce(${posts.publishedAt}, ${posts.discoveredAt})`), desc(posts.id))
      .limit(perSource);
    result.set(sourceId, { total: totalBySource.get(sourceId) ?? 0, recent });
  }
  return result;
}

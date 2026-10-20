import { and, desc, eq, isNotNull, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { posts, sources, subscriptions, type Source } from "@/db/schema";
import { BACKFILL_MAX_AGE_DAYS, DAY_MS, FEED_DAYS } from "./settings";

export type FeedItem = {
  id: number;
  url: string;
  title: string;
  excerpt: string | null;
  images: string[];
  /** Publication date, or the day Plomb discovered the article when the site gives none. */
  date: Date;
  dateIsPublication: boolean;
  /** When Plomb found it (to mark what arrived since the last visit). */
  discoveredAt: Date;
  source: Pick<Source, "id" | "displayName" | "type">;
};

export type FeedFilters = { type?: Source["type"]; sourceId?: number };

/** Upper bound for one week of publications, to keep the page light. */
const MAX_ITEMS = 500;

/**
 * The Salle de Dépêches: publications of the user's sources from the last 7 days, most recent first,
 * each article once even when followed through two sources.
 */
export async function listFeed(
  db: Db,
  userId: string,
  { type, sourceId, now = new Date() }: FeedFilters & { now?: Date } = {},
): Promise<FeedItem[]> {
  const seconds = (date: Date) => Math.floor(date.getTime() / 1000);
  const feedStart = seconds(new Date(now.getTime() - FEED_DAYS * DAY_MS));
  const backfillStart = seconds(new Date(now.getTime() - BACKFILL_MAX_AGE_DAYS * DAY_MS));
  const date = sql<number>`coalesce(${posts.publishedAt}, ${posts.discoveredAt})`;

  const conditions: SQL[] = [
    eq(subscriptions.userId, userId),
    sql`${date} >= ${feedStart}`,
    // Already published when the source was added: only when dated and recent.
    or(
      eq(posts.beforeSubscription, false),
      and(isNotNull(posts.publishedAt), sql`${posts.publishedAt} >= ${backfillStart}`),
    )!,
  ];
  if (type) conditions.push(eq(sources.type, type));
  if (sourceId !== undefined) conditions.push(eq(sources.id, sourceId));

  const rows = await db
    .select({
      id: posts.id,
      url: posts.url,
      title: posts.title,
      excerpt: posts.excerpt,
      images: posts.images,
      imageUrl: posts.imageUrl,
      publishedAt: posts.publishedAt,
      discoveredAt: posts.discoveredAt,
      source: { id: sources.id, displayName: sources.displayName, type: sources.type },
    })
    .from(posts)
    .innerJoin(sources, eq(posts.sourceId, sources.id))
    .innerJoin(subscriptions, eq(subscriptions.sourceId, sources.id))
    .where(and(...conditions))
    .orderBy(desc(date), desc(posts.id))
    .limit(MAX_ITEMS);

  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const row of rows) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    items.push({
      id: row.id,
      url: row.url,
      title: row.title,
      excerpt: row.excerpt,
      images: row.images?.length ? row.images : row.imageUrl ? [row.imageUrl] : [],
      date: row.publishedAt ?? row.discoveredAt,
      dateIsPublication: row.publishedAt !== null,
      discoveredAt: row.discoveredAt,
      source: row.source,
    });
  }
  return items;
}

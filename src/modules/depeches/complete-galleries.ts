import { eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { posts, sources } from "@/db/schema";
import { readArticle } from "@/modules/aspiration-web/article";
import { richerGallery } from "@/modules/aspiration-web/enrich-gallery";
import { parseFeed } from "@/modules/aspiration-web/feed";
import { createPoliteFetcher, type PageFetcher } from "@/modules/fetching/polite-fetch";

/**
 * Articles stored before galleries existed only have one image: reads them again (politely) to fill their gallery.
 * RSS articles: their source's feed is read once. Page articles: each article page is read again.
 * Temporary tool, used once after the `depeches` brick.
 */
export async function completeGalleries(
  db: Db,
  { fetchPage = createPoliteFetcher() }: { fetchPage?: PageFetcher } = {},
): Promise<{ completed: number; failed: number }> {
  const missing = await db
    .select({ id: posts.id, url: posts.url, method: posts.method, imageUrl: posts.imageUrl, feedUrl: sources.feedUrl })
    .from(posts)
    .innerJoin(sources, eq(posts.sourceId, sources.id))
    .where(isNull(posts.images));

  let completed = 0;
  const setGallery = async (id: number, images: string[], fallback: string | null) => {
    await db
      .update(posts)
      .set({ images: images.length > 0 ? images : fallback ? [fallback] : [] })
      .where(eq(posts.id, id));
    completed++;
  };

  // RSS: one read of each feed gives the galleries of all its articles.
  const byFeed = Map.groupBy(
    missing.filter((post) => post.method === "rss" && post.feedUrl),
    (post) => post.feedUrl!,
  );
  for (const [feedUrl, feedPosts] of byFeed) {
    const response = await fetchPage(feedUrl);
    const feed = response.ok && response.status === 200 ? parseFeed(response.body, response.url) : null;
    const galleries = new Map(feed?.ok ? feed.posts.map((post) => [post.url, post.images]) : []);
    for (const post of feedPosts) {
      const fromFeed = galleries.get(post.url) ?? (post.imageUrl ? [post.imageUrl] : []);
      await setGallery(post.id, await richerGallery(post.url, fromFeed, fetchPage), post.imageUrl);
    }
  }

  // Pages: read each article again.
  for (const post of missing.filter((post) => post.method === "page")) {
    const response = await fetchPage(post.url);
    const article = response.ok && response.status === 200 ? readArticle(response.body, response.url) : null;
    await setGallery(post.id, article?.ok ? article.post.images : [], post.imageUrl);
  }

  return { completed, failed: missing.length - completed };
}

export async function countMissingGalleries(db: Db): Promise<number> {
  return (await db.select({ id: posts.id }).from(posts).where(isNull(posts.images))).length;
}

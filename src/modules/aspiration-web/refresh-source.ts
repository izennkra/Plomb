import { and, count, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { posts, seenLinks, sources, type Source } from "@/db/schema";
import { createPoliteFetcher, type PageFetcher, type PoliteResult } from "@/modules/fetching/polite-fetch";
import { readArticle } from "./article";
import { findArticleLinks, readCard } from "./article-links";
import { enrichFromPage } from "./enrich-from-page";
import { findFeedUrls, parseFeed } from "./feed";
import type { PostCandidate } from "./post";
import { purgeOldPosts } from "@/modules/depeches/purge";

/** Articles stored per relève: enough to fill the first edition, without hammering the site. */
const MAX_POSTS_PER_REFRESH = 20;
/** Different sites are read in parallel (each one still at its own polite pace). */
const PARALLEL_SOURCES = 4;
/** A relève running for longer than this has most likely been interrupted (server restart…). */
const STALE_REFRESH_MS = 5 * 60_000;

type Method = "rss" | "page";

/** Sources read by Plomb itself (sites and YouTube channels); social networks go through Apify. */
export const FEED_SOURCE_TYPES: Source["type"][] = ["web", "youtube"];
export const isFeedSource = (type: Source["type"]) => FEED_SOURCE_TYPES.includes(type);

export type RefreshResult = { ok: true; method: Method; added: number } | { ok: false; error: string };

type Found =
  | {
      ok: true;
      method: Method;
      feedUrl: string | null;
      /** Every article address the source lists right now. */
      listed: string[];
      /** The new addresses handled this time (read, or tried). */
      handled: string[];
      posts: PostCandidate[];
      /** New articles that could not be read. */
      unreadable: number;
    }
  | { ok: false; error: string };

const UNREADABLE = "Plomb n'arrive pas à lire ce site (ni flux RSS, ni liste d'articles reconnue).";

/**
 * Fetches the latest articles of a website source and stores the new ones.
 * Tries the method that worked last time first, then the other one.
 */
export async function refreshSource(
  db: Db,
  sourceId: number,
  { fetchPage = createPoliteFetcher() }: { fetchPage?: PageFetcher } = {},
): Promise<RefreshResult> {
  const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });
  if (!source) return { ok: false, error: "Source introuvable." };
  if (!isFeedSource(source.type)) {
    return { ok: false, error: "Les comptes Instagram, X et LinkedIn ne sont pas encore relevés." };
  }

  const found = await findPosts(db, source, fetchPage);
  if (!found.ok) {
    await recordStatus(db, source.id, { lastFetchStatus: "error", lastFetchMessage: found.error });
    return found;
  }

  const added = await store(db, source.id, found);
  if (added === 0 && found.unreadable > 0) {
    const error = `Plomb voit ${found.unreadable} nouvel(s) article(s) mais n'arrive pas à les lire.`;
    await recordStatus(db, source.id, { lastFetchStatus: "error", lastFetchMessage: error });
    return { ok: false, error };
  }
  await recordStatus(db, source.id, {
    lastFetchStatus: "ok",
    lastFetchMessage: newArticlesMessage(added),
    fetchMethod: found.method,
    feedUrl: found.feedUrl,
  });
  return { ok: true, method: found.method, added };
}

/** Relève of every website source, a few sites at a time. One site in error does not stop the others. */
export async function refreshAllSources(
  db: Db,
  { fetchPage = createPoliteFetcher() }: { fetchPage?: PageFetcher } = {},
): Promise<{ sources: number; failed: number; added: number }> {
  const queue = (await db.select({ id: sources.id }).from(sources).where(inArray(sources.type, FEED_SOURCE_TYPES))).map(
    ({ id }) => id,
  );
  const total = queue.length;
  let failed = 0;
  let added = 0;

  async function worker() {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      const result = await refreshSource(db, id, { fetchPage }).catch(
        (): RefreshResult => ({ ok: false, error: "Erreur inattendue pendant le relevé." }),
      );
      if (result.ok) added += result.added;
      else failed++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL_SOURCES, total) }, worker));
  // One week of publications is kept.
  await purgeOldPosts(db);
  return { sources: total, failed, added };
}

/** Shows the sources as "relève en cours" before the relève runs in the background. */
export async function markRefreshing(db: Db, sourceIds: number[]): Promise<void> {
  if (sourceIds.length === 0) return;
  await db
    .update(sources)
    .set({ lastFetchStatus: "running", lastFetchedAt: new Date() })
    .where(inArray(sources.id, sourceIds));
}

export function isRefreshing(source: Pick<Source, "lastFetchStatus" | "lastFetchedAt">, now = Date.now()): boolean {
  return (
    source.lastFetchStatus === "running" &&
    source.lastFetchedAt !== null &&
    now - source.lastFetchedAt.getTime() < STALE_REFRESH_MS
  );
}

/** True when the source is a whole site, or when the article lives under the source's section. */
export function isInSection(postUrl: string, sourceUrl: string): boolean {
  const source = new URL(sourceUrl);
  const section = source.pathname.replace(/\/+$/, "");
  if (!section) return true;
  const post = new URL(postUrl);
  const host = (url: URL) => url.hostname.replace(/^www\./, "");
  return host(post) === host(source) && (post.pathname === section || post.pathname.startsWith(`${section}/`));
}

async function findPosts(db: Db, source: Source, fetchPage: PageFetcher): Promise<Found> {
  // The listing page is only downloaded when needed, and only once.
  let page: Promise<PoliteResult> | undefined;
  const getPage = () => (page ??= fetchPage(source.url));

  const readers: Record<Method, () => Promise<Found>> = {
    rss: () => readFromFeed(db, source, getPage, fetchPage),
    page: () => readFromPage(db, source, getPage, fetchPage),
  };
  // A YouTube channel is only read through its feed.
  const order: Method[] = source.type === "youtube" ? ["rss"] : source.fetchMethod === "page" ? ["page", "rss"] : ["rss", "page"];

  let pageError: string | undefined;
  for (const method of order) {
    const found = await readers[method]();
    if (found.ok) return found;
    pageError ??= pageProblem(await getPage());
  }
  return { ok: false, error: pageError ?? UNREADABLE };
}

async function readFromFeed(
  db: Db,
  source: Source,
  getPage: () => Promise<PoliteResult>,
  fetchPage: PageFetcher,
): Promise<Found> {
  const candidates: string[] = [];
  if (source.feedUrl) candidates.push(source.feedUrl);
  else {
    const page = await getPage();
    if (!page.ok || page.status >= 400) return { ok: false, error: UNREADABLE };
    const { announced, guessed } = findFeedUrls(page.body, page.url);
    // Guessing costs requests: only when the page announces nothing.
    candidates.push(...(announced.length > 0 ? announced : guessed));
  }

  for (const feedUrl of candidates) {
    // A YouTube channel's feed is read like a feed reader does (YouTube's robots.txt targets crawlers).
    const response = await fetchPage(feedUrl, { feedReader: source.type === "youtube" });
    if (!response.ok || response.status !== 200) continue;
    const feed = parseFeed(response.body, response.url);
    if (!feed.ok) continue;

    // A section (site.com/brandnew) may announce the feed of the whole site: keep only its own articles.
    const inSection = source.type === "youtube" ? feed.posts : feed.posts.filter((post) => isInSection(post.url, source.url));
    if (inSection.length === 0) continue;

    const listed = inSection.map((post) => post.url);
    const handled = await newOnes(db, source.id, listed);
    const wanted = new Set(handled);
    const fresh = inSection.filter((post) => wanted.has(post.url));
    // Feeds with a single image or a short extract: the article page gives the gallery and the full text.
    if (source.type === "web") for (const post of fresh) Object.assign(post, await enrichFromPage(post, fetchPage));
    return { ok: true, method: "rss", feedUrl, listed, handled, posts: fresh, unreadable: 0 };
  }
  return { ok: false, error: UNREADABLE };
}

/** Answers of a site that refuses robots (anti-robot protections such as Cloudflare). */
const REFUSED = [401, 403, 429];

async function readFromPage(
  db: Db,
  source: Source,
  getPage: () => Promise<PoliteResult>,
  fetchPage: PageFetcher,
): Promise<Found> {
  const page = await getPage();
  if (!page.ok || page.status >= 400) return { ok: false, error: UNREADABLE };

  const listed = findArticleLinks(page.body, page.url);
  if (listed.length === 0) return { ok: false, error: UNREADABLE };

  // Only open the articles Plomb has never seen listed.
  const handled = await newOnes(db, source.id, listed);
  const found: PostCandidate[] = [];
  for (const url of handled) {
    const response = await fetchPage(url);
    if (response.ok && REFUSED.includes(response.status)) {
      // The site lets Plomb read its list but not its articles: the card of the list is kept.
      const card = readCard(page.body, page.url, url);
      if (card) found.push(card);
      continue;
    }
    if (!response.ok || response.status !== 200) continue;
    const article = readArticle(response.body, response.url);
    if (article.ok) found.push({ ...article.post, url });
  }
  return {
    ok: true,
    method: "page",
    feedUrl: null,
    listed,
    handled,
    posts: found,
    unreadable: handled.length - found.length,
  };
}

/** Listed addresses never seen before, at most one relève's worth, in the source's order (newest first). */
export async function newOnes(db: Db, sourceId: number, listed: string[]): Promise<string[]> {
  if (listed.length === 0) return [];
  const [stored, seen] = await Promise.all([
    db.select({ url: posts.url }).from(posts).where(and(eq(posts.sourceId, sourceId), inArray(posts.url, listed))),
    db
      .select({ url: seenLinks.url })
      .from(seenLinks)
      .where(and(eq(seenLinks.sourceId, sourceId), inArray(seenLinks.url, listed))),
  ]);
  const known = new Set([...stored, ...seen].map((row) => row.url));
  return listed.filter((url) => !known.has(url)).slice(0, MAX_POSTS_PER_REFRESH);
}

/**
 * Stores the new articles. The very first relève of a source is a starting point, not news:
 * its articles are marked as such, and everything it lists is remembered as already seen.
 */
export async function store(
  db: Db,
  sourceId: number,
  found: Pick<Extract<Found, { ok: true }>, "listed" | "handled" | "posts"> & { method: Method | "social" },
): Promise<number> {
  const [[{ storedBefore }], [{ seenBefore }]] = await Promise.all([
    db.select({ storedBefore: count() }).from(posts).where(eq(posts.sourceId, sourceId)),
    db.select({ seenBefore: count() }).from(seenLinks).where(eq(seenLinks.sourceId, sourceId)),
  ]);
  const firstRelève = storedBefore === 0 && seenBefore === 0;

  // Articles that could not be read are remembered too: they are not tried again and again.
  const seen = firstRelève ? found.listed : found.handled;
  if (seen.length > 0) {
    await db
      .insert(seenLinks)
      .values(seen.map((url) => ({ sourceId, url })))
      .onConflictDoNothing();
  }

  if (found.posts.length === 0) return 0;
  const inserted = await db
    .insert(posts)
    .values(found.posts.map((post) => ({ ...post, sourceId, method: found.method, beforeSubscription: firstRelève })))
    .onConflictDoNothing()
    .returning({ id: posts.id });
  return inserted.length;
}

export function newArticlesMessage(added: number): string {
  if (added === 0) return "aucun nouvel article";
  return `${added} ${added > 1 ? "nouveaux articles" : "nouvel article"}`;
}

/** When the listing page itself fails, that is the clearest explanation for the user. */
function pageProblem(page: PoliteResult): string | undefined {
  if (!page.ok) return page.error;
  if (page.status === 404 || page.status === 410) return `Cette page n'existe plus (erreur ${page.status}).`;
  if (page.status >= 400) return `Le site refuse ou n'arrive pas à répondre (erreur ${page.status}).`;
  return undefined;
}

async function recordStatus(db: Db, sourceId: number, values: Partial<typeof sources.$inferInsert>): Promise<void> {
  await db
    .update(sources)
    .set({ ...values, lastFetchedAt: new Date() })
    .where(eq(sources.id, sourceId));
}

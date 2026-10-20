import { and, count, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { posts, sources, type Source } from "@/db/schema";
import { createPoliteFetcher, type PageFetcher, type PoliteResult } from "@/modules/fetching/polite-fetch";
import { readArticle } from "./article";
import { findArticleLinks } from "./article-links";
import { findFeedUrls, parseFeed } from "./feed";
import type { PostCandidate } from "./post";

/** Articles stored per relève: enough to fill the first edition, without hammering the site. */
const MAX_POSTS_PER_REFRESH = 20;

type Method = "rss" | "page";

export type RefreshResult = { ok: true; method: Method; added: number } | { ok: false; error: string };

type Found = { ok: true; method: Method; posts: PostCandidate[]; feedUrl: string | null } | { ok: false; error: string };

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
  if (source.type !== "web") {
    return { ok: false, error: "Les comptes Instagram, X et LinkedIn ne sont pas encore relevés." };
  }

  const found = await findPosts(db, source, fetchPage);
  if (!found.ok) {
    await recordStatus(db, source.id, { lastFetchStatus: "error", lastFetchMessage: found.error });
    return found;
  }

  const added = await store(db, source.id, found);
  await recordStatus(db, source.id, {
    lastFetchStatus: "ok",
    lastFetchMessage: `${added} ${added > 1 ? "nouveaux articles" : "nouvel article"}`,
    fetchMethod: found.method,
    feedUrl: found.feedUrl,
  });
  return { ok: true, method: found.method, added };
}

/** Relève of every website source. One site in error does not stop the others. */
export async function refreshAllSources(
  db: Db,
  { fetchPage = createPoliteFetcher() }: { fetchPage?: PageFetcher } = {},
): Promise<{ sources: number; failed: number; added: number }> {
  const websites = await db.select({ id: sources.id }).from(sources).where(eq(sources.type, "web"));
  let failed = 0;
  let added = 0;
  for (const { id } of websites) {
    const result = await refreshSource(db, id, { fetchPage }).catch(
      (): RefreshResult => ({ ok: false, error: "Erreur inattendue pendant le relevé." }),
    );
    if (result.ok) added += result.added;
    else failed++;
  }
  return { sources: websites.length, failed, added };
}

async function findPosts(db: Db, source: Source, fetchPage: PageFetcher): Promise<Found> {
  // The listing page is only downloaded when needed, and only once.
  let page: Promise<PoliteResult> | undefined;
  const getPage = () => (page ??= fetchPage(source.url));

  const readers: Record<Method, () => Promise<Found>> = {
    rss: () => readFromFeed(source, getPage, fetchPage),
    page: () => readFromPage(db, source, getPage, fetchPage),
  };
  const order: Method[] = source.fetchMethod === "page" ? ["page", "rss"] : ["rss", "page"];

  let pageError: string | undefined;
  for (const method of order) {
    const found = await readers[method]();
    if (found.ok) return found;
    pageError ??= pageProblem(await getPage());
  }
  return { ok: false, error: pageError ?? UNREADABLE };
}

async function readFromFeed(
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
    const response = await fetchPage(feedUrl);
    if (!response.ok || response.status !== 200) continue;
    const feed = parseFeed(response.body, response.url);
    if (feed.ok) return { ok: true, method: "rss", posts: feed.posts, feedUrl };
  }
  return { ok: false, error: UNREADABLE };
}

async function readFromPage(
  db: Db,
  source: Source,
  getPage: () => Promise<PoliteResult>,
  fetchPage: PageFetcher,
): Promise<Found> {
  const page = await getPage();
  if (!page.ok || page.status >= 400) return { ok: false, error: UNREADABLE };

  const links = findArticleLinks(page.body, page.url);
  if (links.length === 0) return { ok: false, error: UNREADABLE };

  // Only open the articles Plomb does not know yet.
  const known = await knownUrls(db, source.id, links);
  const toRead = links.filter((url) => !known.has(url)).slice(0, MAX_POSTS_PER_REFRESH);

  const found: PostCandidate[] = [];
  for (const url of toRead) {
    const response = await fetchPage(url);
    if (!response.ok || response.status !== 200) continue;
    const article = readArticle(response.body, response.url);
    if (article.ok) found.push({ ...article.post, url });
  }
  if (toRead.length > 0 && found.length === 0) return { ok: false, error: UNREADABLE };
  return { ok: true, method: "page", posts: found, feedUrl: null };
}

/** Stores new articles. The very first relève of a source is a starting point, not news. */
async function store(db: Db, sourceId: number, found: Extract<Found, { ok: true }>): Promise<number> {
  const known = await knownUrls(db, sourceId, found.posts.map((post) => post.url));
  const fresh = found.posts.filter((post) => !known.has(post.url)).slice(0, MAX_POSTS_PER_REFRESH);
  if (fresh.length === 0) return 0;

  const [{ existing }] = await db.select({ existing: count() }).from(posts).where(eq(posts.sourceId, sourceId));
  const inserted = await db
    .insert(posts)
    .values(fresh.map((post) => ({ ...post, sourceId, method: found.method, beforeSubscription: existing === 0 })))
    .onConflictDoNothing()
    .returning({ id: posts.id });
  return inserted.length;
}

async function knownUrls(db: Db, sourceId: number, urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const rows = await db
    .select({ url: posts.url })
    .from(posts)
    .where(and(eq(posts.sourceId, sourceId), inArray(posts.url, urls)));
  return new Set(rows.map((row) => row.url));
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

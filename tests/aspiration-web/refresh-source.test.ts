import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_USER_ID } from "@/db/client";
import { posts, sources } from "@/db/schema";
import { refreshAllSources, refreshSource } from "@/modules/aspiration-web/refresh-source";
import { createPoliteFetcher } from "@/modules/fetching/polite-fetch";
import { safeFetch } from "@/modules/fetching/safe-fetch";
import { addSource } from "@/modules/sources/add-source";
import { createTestDb } from "../helpers/test-db";
import { startTestServer, type TestServer } from "../helpers/test-server";

/** A fake studio website whose articles can change between two relèves. */
const site = {
  blog: [] as string[],
  news: [] as string[],
  hits: [] as string[],
};

const slug = (i: number) => `a-long-article-title-number-${i}`;

function articlePage(path: string) {
  return `<html><head>
    <meta property="og:title" content="Title of ${path}">
    <meta property="og:description" content="Summary of ${path}">
    <meta property="og:image" content="/img/${path.split("/").pop()}.jpg">
  </head><body><article><p>${"Full text. ".repeat(50)}</p></article></body></html>`;
}

function feed(slugs: string[], base: string) {
  const items = slugs
    .map(
      (s, i) => `<item><title>News ${s}</title><link>${base}/news/${s}</link>
        <pubDate>${new Date(Date.UTC(2026, 9, 20 - i)).toUTCString()}</pubDate>
        <description>About ${s}</description></item>`,
    )
    .join("");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>News</title>${items}</channel></rss>`;
}

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer((req, res) => {
    const url = req.url ?? "/";
    site.hits.push(url);
    const html = (body: string) => res.writeHead(200, { "content-type": "text/html" }).end(body);
    if (url === "/blog") return html(site.blog.map((s) => `<a href="/blog/${s}">${s}</a>`).join(""));
    if (url.startsWith("/blog/")) return html(articlePage(url));
    if (url === "/news") return html(`<link rel="alternate" type="application/rss+xml" href="/news/feed">`);
    if (url === "/news/feed") return res.writeHead(200, { "content-type": "application/rss+xml" }).end(feed(site.news, server.base));
    if (url === "/menu") return html(`<a href="/about">About</a><a href="/contact">Contact</a>`);
    res.writeHead(404).end();
  });
});

afterAll(() => server.close());

beforeEach(() => {
  site.blog = [1, 2, 3, 4, 5].map(slug);
  site.news = [1, 2, 3].map(slug);
  site.hits = [];
});

/** Real polite fetcher, without the 1 s pauses, allowed to reach the local test server. */
const fetchPage = () =>
  createPoliteFetcher({ fetch: (url) => safeFetch(url, { allowInternal: true }), sleep: async () => {} });

async function setup(path: string) {
  const db = await createTestDb();
  const added = await addSource(db, DEFAULT_USER_ID, `${server.base}${path}`, {
    checkWebsite: async (url) => ({ ok: true, finalUrl: url }),
  });
  if (!added.ok) throw new Error(added.error);
  return { db, sourceId: added.source.id };
}

const postsOf = (db: Awaited<ReturnType<typeof createTestDb>>, sourceId: number) =>
  db.select().from(posts).where(eq(posts.sourceId, sourceId));

describe("refreshSource — site without RSS (page reading)", () => {
  it("first relève: stores the articles, marked as published before the subscription", async () => {
    const { db, sourceId } = await setup("/blog");

    const result = await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    expect(result).toEqual({ ok: true, method: "page", added: 5 });
    const stored = await postsOf(db, sourceId);
    expect(stored).toHaveLength(5);
    expect(stored.every((post) => post.beforeSubscription)).toBe(true);
    expect(stored[0]).toMatchObject({
      title: `Title of /blog/${slug(1)}`,
      excerpt: `Summary of /blog/${slug(1)}`,
      imageUrl: `${server.base}/img/${slug(1)}.jpg`,
      method: "page",
    });
    expect(stored[0].content).toMatch(/Full text/);
  });

  it("next relève: only the new article, opened alone, and it is real news", async () => {
    const { db, sourceId } = await setup("/blog");
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    site.blog.unshift(slug(6));
    site.hits = [];
    const result = await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    expect(result).toEqual({ ok: true, method: "page", added: 1 });
    expect(site.hits.filter((hit) => hit.startsWith("/blog/"))).toEqual([`/blog/${slug(6)}`]);
    const stored = await postsOf(db, sourceId);
    expect(stored).toHaveLength(6);
    expect(stored.find((post) => post.url.endsWith(slug(6)))?.beforeSubscription).toBe(false);
  });

  it("stores at most 20 articles per relève", async () => {
    site.blog = Array.from({ length: 25 }, (_, i) => slug(i));
    const { db, sourceId } = await setup("/blog");

    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toMatchObject({ ok: true, added: 20 });
  });

  it("remembers the method and records the status on the source", async () => {
    const { db, sourceId } = await setup("/blog");
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });
    expect(source).toMatchObject({ fetchMethod: "page", lastFetchStatus: "ok", lastFetchMessage: "5 nouveaux articles" });
    expect(source?.lastFetchedAt).toBeInstanceOf(Date);
  });
});

describe("refreshSource — site with RSS", () => {
  it("reads the feed, with dates, and never duplicates", async () => {
    const { db, sourceId } = await setup("/news");

    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toEqual({ ok: true, method: "rss", added: 3 });
    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toEqual({ ok: true, method: "rss", added: 0 });

    const stored = await postsOf(db, sourceId);
    expect(stored).toHaveLength(3);
    expect(stored[0].publishedAt).toEqual(new Date(Date.UTC(2026, 9, 20)));
    const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });
    expect(source).toMatchObject({ fetchMethod: "rss", feedUrl: `${server.base}/news/feed` });
  });

  it("goes straight to the remembered feed next time", async () => {
    const { db, sourceId } = await setup("/news");
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    site.news.unshift(slug(4));
    site.hits = [];
    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toMatchObject({ added: 1 });
    expect(site.hits).not.toContain("/news");
  });
});

describe("refreshSource — failures", () => {
  it("marks a site it cannot understand as unreadable, without fake articles", async () => {
    const { db, sourceId } = await setup("/menu");

    const result = await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/n'arrive pas à lire/) });
    expect(await postsOf(db, sourceId)).toHaveLength(0);
    const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });
    expect(source).toMatchObject({ lastFetchStatus: "error", lastFetchMessage: expect.stringMatching(/n'arrive pas à lire/) });
  });

  it("reports a page that no longer exists", async () => {
    const { db, sourceId } = await setup("/gone");
    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toEqual({
      ok: false,
      error: expect.stringMatching(/404/),
    });
  });

  it("does not read Instagram / X / LinkedIn sources yet", async () => {
    const db = await createTestDb();
    const added = await addSource(db, DEFAULT_USER_ID, "instagram.com/mouthwash.studio");
    if (!added.ok) throw new Error(added.error);

    expect(await refreshSource(db, added.source.id, { fetchPage: fetchPage() })).toEqual({
      ok: false,
      error: expect.stringMatching(/pas encore/),
    });
  });
});

describe("refreshAllSources", () => {
  it("one failing site does not stop the others", async () => {
    const { db } = await setup("/menu");
    const other = await addSource(db, DEFAULT_USER_ID, `${server.base}/blog`, {
      checkWebsite: async (url) => ({ ok: true, finalUrl: url }),
    });
    if (!other.ok) throw new Error(other.error);

    const summary = await refreshAllSources(db, { fetchPage: fetchPage() });

    expect(summary).toEqual({ sources: 2, failed: 1, added: 5 });
  });
});

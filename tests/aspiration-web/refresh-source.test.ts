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
    if (url === "/blog/broken-article-that-has-no-title") return html("<p>no title here</p>");
    if (url.startsWith("/blog/")) return html(articlePage(url));
    if (url === "/news") return html(`<link rel="alternate" type="application/rss+xml" href="/news/feed">`);
    if (url.startsWith("/news/") && url !== "/news/feed") {
      const name = url.split("/").pop();
      return html(`<html><head><meta property="og:title" content="t"><meta property="og:image" content="/g/${name}-1.jpg"></head>
        <body><img src="/g/${name}-2.jpg"><img src="/g/${name}-3.jpg"></body></html>`);
    }
    if (url === "/news/feed") return res.writeHead(200, { "content-type": "application/rss+xml" }).end(feed(site.news, server.base));
    if (url === "/menu") return html(`<a href="/about">About</a><a href="/contact">Contact</a>`);
    // A section (/mag/brand) whose page announces the feed of the whole site, about other things.
    if (url === "/mag/brand")
      return html(
        `<link rel="alternate" type="application/rss+xml" href="/feed">` +
          site.blog.map((s) => `<a href="/mag/brand/${s}">${s}</a>`).join(""),
      );
    if (url.startsWith("/mag/brand/")) return html(articlePage(url));
    if (url === "/feed")
      return res
        .writeHead(200, { "content-type": "application/rss+xml" })
        .end(feed(["company-news-about-our-conference", "another-company-announcement-here"], `${server.base}/company`));
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
      images: [`${server.base}/img/${slug(1)}.jpg`],
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

  it("does not take the older articles left out of the first relève for news", async () => {
    site.blog = Array.from({ length: 25 }, (_, i) => slug(i));
    const { db, sourceId } = await setup("/blog");
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toMatchObject({ ok: true, added: 0 });

    site.blog.unshift(slug(99));
    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toMatchObject({ ok: true, added: 1 });
  });

  it("same rule for a long RSS feed", async () => {
    site.news = Array.from({ length: 25 }, (_, i) => slug(i));
    const { db, sourceId } = await setup("/news");

    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toMatchObject({ added: 20 });
    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toMatchObject({ added: 0 });
  });

  it("does not retry forever an article that cannot be read", async () => {
    const { db, sourceId } = await setup("/blog");
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    site.blog.unshift("broken-article-that-has-no-title");
    site.hits = [];
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });
    site.hits = [];
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    expect(site.hits).not.toContain("/blog/broken-article-that-has-no-title");
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

  it("reads the article page for its gallery when the feed has a single image", async () => {
    const { db, sourceId } = await setup("/news");
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    const [post] = await postsOf(db, sourceId);
    expect(post.images).toHaveLength(3);
  });

  it("goes straight to the remembered feed next time", async () => {
    const { db, sourceId } = await setup("/news");
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    site.news.unshift(slug(4));
    site.hits = [];
    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toMatchObject({ added: 1 });
    expect(site.hits).not.toContain("/news");
    expect(site.hits.filter((hit) => hit.startsWith("/news/a-"))).toEqual([`/news/${slug(4)}`]);
  });
});

describe("refreshSource — section of a site", () => {
  it("ignores a site-wide feed that has nothing from the section, and reads the page instead", async () => {
    const { db, sourceId } = await setup("/mag/brand");

    expect(await refreshSource(db, sourceId, { fetchPage: fetchPage() })).toEqual({ ok: true, method: "page", added: 5 });
    for (const post of await postsOf(db, sourceId)) expect(post.url).toContain("/mag/brand/");
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

  it("says when there is nothing new", async () => {
    const { db, sourceId } = await setup("/blog");
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });
    await refreshSource(db, sourceId, { fetchPage: fetchPage() });

    const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });
    expect(source?.lastFetchMessage).toBe("aucun nouvel article");
  });
});

describe("isInSection", () => {
  it("accepts everything for a whole site", async () => {
    const { isInSection } = await import("@/modules/aspiration-web/refresh-source");
    expect(isInSection("https://other.com/a", "https://www.itsnicethat.com/")).toBe(true);
  });

  it("keeps only the section's articles, with or without www", async () => {
    const { isInSection } = await import("@/modules/aspiration-web/refresh-source");
    const section = "https://www.underconsideration.com/brandnew";
    expect(isInSection("https://underconsideration.com/brandnew/archives/a.php", section)).toBe(true);
    expect(isInSection("https://underconsideration.com/headline_news/conference", section)).toBe(false);
    expect(isInSection("https://underconsideration.com/brandnewsletter/x", section)).toBe(false);
  });
});

describe("isRefreshing", () => {
  it("is true only while a relève is recent", async () => {
    const { isRefreshing } = await import("@/modules/aspiration-web/refresh-source");
    const now = Date.parse("2026-10-20T10:00:00Z");
    expect(isRefreshing({ lastFetchStatus: "running", lastFetchedAt: new Date(now - 60_000) }, now)).toBe(true);
    expect(isRefreshing({ lastFetchStatus: "running", lastFetchedAt: new Date(now - 10 * 60_000) }, now)).toBe(false);
    expect(isRefreshing({ lastFetchStatus: "ok", lastFetchedAt: new Date(now) }, now)).toBe(false);
  });
});

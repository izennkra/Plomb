import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { posts, sources } from "@/db/schema";
import { completeGalleries, countMissingGalleries } from "@/modules/depeches/complete-galleries";
import { createPoliteFetcher } from "@/modules/fetching/polite-fetch";
import { safeFetch } from "@/modules/fetching/safe-fetch";
import { createTestDb } from "../helpers/test-db";
import { startTestServer, type TestServer } from "../helpers/test-server";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer((req, res) => {
    if (req.url === "/blog/my-long-project-article-title") {
      res.writeHead(200, { "content-type": "text/html" }).end(`<html><head>
        <meta property="og:title" content="Project"><meta property="og:image" content="/img/my-project-name-here-1.jpg">
        </head><body><img src="/img/my-project-name-here-2.jpg"><img src="/img/my-project-name-here-3.jpg"></body></html>`);
      return;
    }
    if (req.url === "/feed") {
      res.writeHead(200, { "content-type": "application/rss+xml" }).end(`<?xml version="1.0"?><rss version="2.0"><channel><title>F</title>
        <item><title>News</title><link>${server.base}/news/a-news-item</link>
        <description><![CDATA[<img src="${server.base}/n/photo-a.jpg"><img src="${server.base}/n/photo-b.jpg">]]></description></item>
        </channel></rss>`);
      return;
    }
    res.writeHead(404).end();
  });
});

afterAll(() => server.close());

const fetchPage = () =>
  createPoliteFetcher({ fetch: (url) => safeFetch(url, { allowInternal: true }), sleep: async () => {} });

describe("completeGalleries", () => {
  it("fills the galleries of page and RSS articles stored without one", async () => {
    const db = await createTestDb();
    const [blog, news] = await db
      .insert(sources)
      .values([
        { type: "web", displayName: "blog", url: `${server.base}/blog`, key: "web:blog" },
        { type: "web", displayName: "news", url: `${server.base}/news`, key: "web:news", feedUrl: `${server.base}/feed` },
      ])
      .returning({ id: sources.id });
    await db.insert(posts).values([
      { sourceId: blog.id, url: `${server.base}/blog/my-long-project-article-title`, title: "Project", method: "page" },
      { sourceId: news.id, url: `${server.base}/news/a-news-item`, title: "News", method: "rss" },
      { sourceId: blog.id, url: `${server.base}/blog/gone`, title: "Gone", method: "page", imageUrl: "https://x/one.jpg" },
    ]);
    expect(await countMissingGalleries(db)).toBe(3);

    expect(await completeGalleries(db, { fetchPage: fetchPage() })).toEqual({ completed: 3, failed: 0 });

    const stored = await db.select().from(posts);
    expect(stored.find((post) => post.title === "Project")?.images).toHaveLength(3);
    expect(stored.find((post) => post.title === "News")?.images).toEqual([
      `${server.base}/n/photo-a.jpg`,
      `${server.base}/n/photo-b.jpg`,
    ]);
    // Page gone: keeps its single known image, and is not retried.
    expect(stored.find((post) => post.title === "Gone")?.images).toEqual(["https://x/one.jpg"]);
    expect(await countMissingGalleries(db)).toBe(0);
  });
});

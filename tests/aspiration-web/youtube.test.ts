import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFeed } from "@/modules/aspiration-web/feed";
import { findYoutubeFeed } from "@/modules/aspiration-web/youtube";

const dir = join(__dirname, "..", "fixtures", "sites", "youtube-itsnicethat");
const channelPage = readFileSync(join(dir, "channel.html"), "utf8");
const feedXml = readFileSync(join(dir, "feed.xml"), "utf8");
const FEED = "https://www.youtube.com/feeds/videos.xml?channel_id=UChPo_E4H5QTm-OXBALKerXw";

describe("YouTube", () => {
  it("finds the channel's feed from its page", () => {
    expect(findYoutubeFeed(channelPage)).toEqual({ feedUrl: FEED, name: "It's Nice That" });
  });

  it("finds the feed from the channel id when the page announces none", () => {
    const page = `<html><body><script>{"externalId":"UChPo_E4H5QTm-OXBALKerXw"}</script></body></html>`;
    expect(findYoutubeFeed(page)?.feedUrl).toBe(FEED);
  });

  it("returns nothing for a page that is not a channel", () => {
    expect(findYoutubeFeed("<html><body>Not found</body></html>")).toBeNull();
  });

  it("reads the videos: title, link, date, large thumbnail, description", () => {
    const result = parseFeed(feedXml, FEED);
    if (!result.ok) throw new Error(result.error);

    expect(result.posts).toHaveLength(15);
    const [latest] = result.posts;
    expect(latest).toMatchObject({
      url: "https://www.youtube.com/watch?v=n5PkNF61z9w",
      title: "Why self-publishing pays off | No Ideas",
      publishedAt: new Date("2026-10-20T10:33:22+00:00"),
      imageUrl: "https://i3.ytimg.com/vi/n5PkNF61z9w/hqdefault.jpg",
      images: ["https://i3.ytimg.com/vi/n5PkNF61z9w/hqdefault.jpg"],
    });
    expect(latest.excerpt).toMatch(/^Philip DiBello and Devin Washburn of Brooklyn-based design studio No Ideas/);
    expect(latest.content).toMatch(/If you build it, they will come/);
  });
});

describe("YouTube channel in Plomb", () => {
  it("is added with its feed remembered, then its videos are read", async () => {
    const { createTestDb } = await import("../helpers/test-db");
    const { startTestServer } = await import("../helpers/test-server");
    const { DEFAULT_USER_ID } = await import("@/db/client");
    const { posts, sources } = await import("@/db/schema");
    const { addSource } = await import("@/modules/sources/add-source");
    const { refreshSource } = await import("@/modules/aspiration-web/refresh-source");
    const { createPoliteFetcher } = await import("@/modules/fetching/polite-fetch");
    const { safeFetch } = await import("@/modules/fetching/safe-fetch");

    const server = await startTestServer((_req, res) => res.writeHead(200, { "content-type": "application/atom+xml" }).end(feedXml));
    try {
      const db = await createTestDb();
      const added = await addSource(db, DEFAULT_USER_ID, "https://www.youtube.com/@itsnicethat", {
        findChannel: async () => ({ ok: true, feedUrl: `${server.base}/feed`, name: "It's Nice That" }),
      });
      if (!added.ok) throw new Error(added.error);
      expect(added.source).toMatchObject({ type: "youtube", feedUrl: `${server.base}/feed`, fetchMethod: "rss" });

      const fetchPage = createPoliteFetcher({ fetch: (url) => safeFetch(url, { allowInternal: true }), sleep: async () => {} });
      expect(await refreshSource(db, added.source.id, { fetchPage })).toEqual({ ok: true, method: "rss", added: 15 });

      const stored = await db.select().from(posts);
      expect(stored[0]).toMatchObject({ url: expect.stringMatching(/^https:\/\/www\.youtube\.com\/watch\?v=/), method: "rss" });
      expect((await db.select().from(sources))[0].lastFetchStatus).toBe("ok");
    } finally {
      await server.close();
    }
  });

  it("is refused with a clear message when the channel cannot be found", async () => {
    const { createTestDb } = await import("../helpers/test-db");
    const { DEFAULT_USER_ID } = await import("@/db/client");
    const { addSource } = await import("@/modules/sources/add-source");
    const db = await createTestDb();

    const result = await addSource(db, DEFAULT_USER_ID, "youtube.com/@doesnotexist", {
      findChannel: async () => ({ ok: false, error: "Cette chaîne YouTube n'existe pas. Vérifiez l'adresse." }),
    });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/n'existe pas/) });
  });
});

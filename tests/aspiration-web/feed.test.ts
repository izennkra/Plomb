import { describe, expect, it } from "vitest";
import { findFeedUrls, parseFeed } from "@/modules/aspiration-web/feed";
import { fixture, fixtureMeta } from "../helpers/fixtures";

describe("findFeedUrls", () => {
  it("finds the feed announced by a Substack page", () => {
    const { listUrl } = fixtureMeta("findings");
    expect(findFeedUrls(fixture("findings", "list.html"), listUrl).announced).toEqual([
      "https://findings.mouthwash.studio/feed",
    ]);
  });

  it("ignores a podcast feed (Brand New)", () => {
    const { listUrl } = fixtureMeta("brandnew");
    expect(findFeedUrls(fixture("brandnew", "list.html"), listUrl).announced).toEqual([]);
  });

  it("suggests usual addresses when nothing is announced", () => {
    const { announced, guessed } = findFeedUrls(fixture("the-brandidentity", "list.html"), "https://the-brandidentity.com/features");
    expect(announced).toEqual([]);
    expect(guessed).toEqual([
      "https://the-brandidentity.com/features/feed",
      "https://the-brandidentity.com/feed",
      "https://the-brandidentity.com/rss.xml",
    ]);
  });

  it("does not suggest the same address twice for a home page", () => {
    expect(findFeedUrls("<html></html>", "https://example.com/").guessed).toEqual([
      "https://example.com/feed",
      "https://example.com/rss.xml",
    ]);
  });
});

describe("parseFeed", () => {
  it("reads the Findings feed (RSS, Substack)", () => {
    const result = parseFeed(fixture("findings", "feed.xml"), "https://findings.mouthwash.studio/feed");
    if (!result.ok) throw new Error(result.error);

    expect(result.posts).toHaveLength(15);
    const [first] = result.posts;
    expect(first).toMatchObject({
      url: "https://findings.mouthwash.studio/p/the-cost-of-eating-well",
      title: "The Cost of Eating Well",
      excerpt: expect.stringContaining("Luxury Grocery"),
      imageUrl: expect.stringMatching(/^https:\/\/substack-post-media.*\.webp$/),
      publishedAt: new Date("2026-09-14T16:01:21.000Z"),
    });
    expect(first.content?.length).toBeGreaterThan(500);
    expect(first.content).not.toMatch(/<\w+/); // plain text, no HTML
  });

  it("does not take an audio file as image (OFF Brand)", () => {
    const result = parseFeed(fixture("offbrand", "feed.xml"), "https://offbrandkoto.substack.com/feed");
    if (!result.ok) throw new Error(result.error);

    expect(result.posts).toHaveLength(17);
    for (const post of result.posts) {
      expect(post.imageUrl ?? "").not.toMatch(/\.mp3/);
    }
    expect(result.posts.filter((post) => post.imageUrl).length).toBeGreaterThan(10);
  });

  it("reads an Atom feed with relative links", () => {
    const atom = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Studio</title>
        <entry>
          <title>New identity</title>
          <link href="/work/new-identity"/>
          <id>tag:studio,2026:1</id>
          <updated>2026-10-19T08:00:00Z</updated>
          <summary>A short summary</summary>
        </entry>
      </feed>`;
    const result = parseFeed(atom, "https://studio.example/atom.xml");
    expect(result).toMatchObject({
      ok: true,
      posts: [{ url: "https://studio.example/work/new-identity", title: "New identity", excerpt: "A short summary" }],
    });
  });

  it("refuses an HTML page pretending to be a feed (the-brandidentity.com/feed)", () => {
    expect(parseFeed(fixture("the-brandidentity", "list.html"), "https://the-brandidentity.com/feed")).toMatchObject({
      ok: false,
    });
  });

  it("refuses a feed without any article", () => {
    const empty = `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty</title></channel></rss>`;
    expect(parseFeed(empty, "https://example.com/feed")).toMatchObject({ ok: false });
  });
});

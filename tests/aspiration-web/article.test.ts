import { describe, expect, it } from "vitest";
import { readArticle } from "@/modules/aspiration-web/article";
import { fixture, fixtureMeta, type SiteName } from "../helpers/fixtures";

function read(site: SiteName) {
  const result = readArticle(fixture(site, "article.html"), fixtureMeta(site).articleUrl!);
  if (!result.ok) throw new Error(result.error);
  return result.post;
}

describe("readArticle — real articles", () => {
  it("The Brand Identity: clean title, summary, HD image, date", () => {
    const post = read("the-brandidentity");
    expect(post).toMatchObject({
      url: fixtureMeta("the-brandidentity").articleUrl,
      title: "Studio Hi Ho pairs kraft and butter yellow in Madeleine’s packaging",
      excerpt: expect.stringMatching(/^Madeleine is a Melbourne-based cultured butter maker/),
      imageUrl: expect.stringMatching(/^https:\/\/the-brandidentity\.com\/uploads\/.*\.jpg$/),
      publishedAt: new Date("2026-10-19"),
    });
    expect(post.excerpt!.length).toBeLessThanOrEqual(300);
    expect(post.content).toMatch(/malaxer/);
  });

  it("It's Nice That: date shown in the page", () => {
    const post = read("itsnicethat");
    expect(post.title).toMatch(/^Studio Herrström gives disruptor music label/);
    expect(post.imageUrl).toMatch(/^https:\/\/m\.itsnicethat\.com\//);
    expect(post.publishedAt?.toISOString().slice(0, 10)).toMatch(/^2026-10-(19|20)$/);
    expect(post.content?.length).toBeGreaterThan(500);
  });

  it("Brand New: no date given → null (the discovery date will be used)", () => {
    const post = read("brandnew");
    expect(post.title).toBe("Between a Rock and a Hard Ace");
    expect(post.excerpt).toMatch(/Hard Rock Bet Casino/);
    expect(post.imageUrl).toMatch(/hard_rock_bet_casino_new\.png$/);
    expect(post.publishedAt).toBeNull();
  });

  it("D&AD: title and text", () => {
    const post = read("dandad");
    expect(post.title).toMatch(/A Collection of Typography from The World's Most Beautiful Books/);
    expect(post.content?.length).toBeGreaterThan(100);
  });
});

describe("readArticle — rules", () => {
  const html = (head: string, body = "<p>Some text</p>") => `<html><head>${head}</head><body>${body}</body></html>`;

  it("reads the date from JSON-LD", () => {
    const page = html(
      `<meta property="og:title" content="A title"><script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","datePublished":"2026-10-18T09:30:00Z"}]}</script>`,
    );
    const result = readArticle(page, "https://example.com/a");
    expect(result.ok && result.post.publishedAt).toEqual(new Date("2026-10-18T09:30:00Z"));
  });

  it("falls back to <title> and resolves a relative image", () => {
    const page = html(`<title>Plain title | Example</title><meta property="og:site_name" content="Example"><meta property="og:image" content="/img/cover.jpg">`);
    const result = readArticle(page, "https://example.com/a");
    expect(result).toMatchObject({ ok: true, post: { title: "Plain title", imageUrl: "https://example.com/img/cover.jpg" } });
  });

  it("refuses a page without a usable title", () => {
    expect(readArticle(html(""), "https://example.com/a")).toMatchObject({ ok: false });
  });
});

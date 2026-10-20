import { describe, expect, it } from "vitest";
import { findArticleLinks, readCard } from "@/modules/aspiration-web/article-links";
import { fixture, fixtureMeta, type SiteName } from "../helpers/fixtures";

function linksOf(site: SiteName) {
  return findArticleLinks(fixture(site, "list.html"), fixtureMeta(site).listUrl);
}

describe("findArticleLinks — real sites", () => {
  it("the-brandidentity.com/features → projects and interviews", () => {
    const links = linksOf("the-brandidentity");
    expect(links.length).toBeGreaterThanOrEqual(10);
    // Slugs may contain encoded accents: m%C3%A1laga
    for (const link of links) expect(link).toMatch(/^https:\/\/the-brandidentity\.com\/(project|interview)\/[\w%-]+$/);
    expect(links).toContain(fixtureMeta("the-brandidentity").articleUrl);
  });

  it("itsnicethat.com → articles and features, no tags or authors", () => {
    const links = linksOf("itsnicethat");
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const link of links) expect(link).toMatch(/^https:\/\/www\.itsnicethat\.com\/(articles|features)\/[\w%-]+$/);
  });

  it("Brand New → articles only, none of the 44 category links", () => {
    const links = linksOf("brandnew");
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const link of links) {
      expect(link).toMatch(/^https:\/\/www\.underconsideration\.com\/brandnew\/archives\/[\w-]+\.php$/);
    }
  });

  it("D&AD → entries of the awards archive", () => {
    const links = linksOf("dandad");
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const link of links) expect(link).toMatch(/^https:\/\/www\.dandad\.org\/work\/d-ad-awards-archive\/[\w-]+$/);
  });

  it("D&AD insights → editorial articles", () => {
    const links = linksOf("dandad-insights");
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const link of links) expect(link).toMatch(/^https:\/\/www\.dandad\.org\/insights\/[\w-]+\/[\w%-]+$/);
  });

  it("D&AD work (showcase with short addresses) → nothing: marked unreadable until level 3", () => {
    expect(linksOf("dandad-work")).toEqual([]);
  });

  it("returns each article once, in page order", () => {
    const links = linksOf("itsnicethat");
    expect(new Set(links).size).toBe(links.length);
  });
});

describe("findArticleLinks — rules", () => {
  const page = (hrefs: string[]) => `<html><body>${hrefs.map((href) => `<a href="${href}">x</a>`).join("")}</body></html>`;

  it("finds nothing on a page made only of menus and categories", () => {
    const html = page(["/about", "/contact", "/category/branding", "/category/food-drink", "/tag/blue", "/shop"]);
    expect(findArticleLinks(html, "https://example.com/")).toEqual([]);
  });

  it("ignores links to other sites", () => {
    const html = page([
      "https://other.com/news/a-long-article-title-about-design",
      "https://other.com/news/another-long-article-title-here",
      "https://other.com/news/yet-another-long-article-title",
    ]);
    expect(findArticleLinks(html, "https://example.com/")).toEqual([]);
  });

  it("needs at least 3 articles in the same family", () => {
    const html = page(["/news/a-long-article-title-about-design", "/news/another-long-article-title-here"]);
    expect(findArticleLinks(html, "https://example.com/")).toEqual([]);
  });

  it("ignores long links in category, tag or author families", () => {
    const html = page([
      "/tag/a-very-long-tag-name-here",
      "/tag/another-very-long-tag-name",
      "/tag/third-very-long-tag-name",
      "/author/jean-pierre-de-la-fontaine",
      "/author/marie-claire-de-saint-exupery",
      "/author/anne-sophie-de-la-tour",
    ]);
    expect(findArticleLinks(html, "https://example.com/")).toEqual([]);
  });

  it("ignores a few one-off pages next to a large family of articles", () => {
    const articles = Array.from({ length: 12 }, (_, i) => `/articles/a-long-article-title-number-${i}`);
    const oneOffs = ["/diversity-equity-inclusion-statement-page", "/ones-to-watch-2026-showcase", "/review-of-the-year-edition"];
    const links = findArticleLinks(page([...articles, ...oneOffs]), "https://example.com/");
    expect(links).toHaveLength(12);
  });

  it("accepts articles at the root of a blog", () => {
    const html = page(["/my-first-long-article-title", "/my-second-long-article-title", "/my-third-long-article-title"]);
    expect(findArticleLinks(html, "https://blog.example/")).toHaveLength(3);
  });

  it("cleans tracking parameters and ignores the page itself", () => {
    const html = page([
      "/news?utm_source=x",
      "/news/first-long-article-title-here?utm_source=newsletter",
      "/news/second-long-article-title-here#comments",
      "/news/third-long-article-title-here",
    ]);
    expect(findArticleLinks(html, "https://example.com/news")).toEqual([
      "https://example.com/news/first-long-article-title-here",
      "https://example.com/news/second-long-article-title-here",
      "https://example.com/news/third-long-article-title-here",
    ]);
  });
});

describe("readCard — an article seen only on its list page", () => {
  it("The Brand Identity home page: title and image of the card", () => {
    const url = "https://the-brandidentity.com/project/why-carolanebel-studio-turned-a-fleur-de-lys-into-a-bird-for-club-pays";
    const card = readCard(fixture("the-brandidentity", "home.html"), "https://the-brandidentity.com/", url);
    expect(card).toMatchObject({ url, imageUrl: "https://the-brandidentity.com/uploads/videos/13888240.jpg" });
    expect(card?.title).toMatch(/Carolanebel/i);
    expect(card?.title).not.toBe("Project");
  });

  it("The Brand Identity features page: the longest heading is the title, not the « Project » label", () => {
    const { listUrl, articleUrl } = fixtureMeta("the-brandidentity");
    const card = readCard(fixture("the-brandidentity", "list.html"), listUrl, articleUrl!);
    expect(card?.title).toBe("Studio Hi Ho pairs kraft and butter yellow in Madeleine’s packaging");
  });

  it("nothing when the list has no card for this address", () => {
    expect(readCard("<a href='/other'>Other</a>", "https://a.com/", "https://a.com/project/missing-article-here-now")).toBeNull();
  });
});

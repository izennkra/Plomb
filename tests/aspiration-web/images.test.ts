import { describe, expect, it } from "vitest";
import { readArticle } from "@/modules/aspiration-web/article";
import { findArticleImages } from "@/modules/aspiration-web/images";
import { fixture, fixtureMeta, type SiteName } from "../helpers/fixtures";

function galleryOf(site: SiteName) {
  const result = readArticle(fixture(site, "article.html"), fixtureMeta(site).articleUrl!);
  if (!result.ok) throw new Error(result.error);
  return result.post.images;
}

describe("article gallery — real articles", () => {
  it("The Brand Identity → the 8 images of the article folder, main image first", () => {
    const images = galleryOf("the-brandidentity");
    expect(images).toHaveLength(8);
    expect(images[0]).toMatch(/Madeleine-Studio-Hi-Ho-01\.jpg$/);
    for (const image of images) {
      expect(image).toContain("/uploads/articles/2026/10/studio-hi-ho-pairs-kraft-and-butter-yellow-in-madeleines-packaging/");
    }
  });

  it("It's Nice That → the 12 images of the project (GIFs included), in order", () => {
    const images = galleryOf("itsnicethat");
    expect(images).toHaveLength(12);
    for (const image of images) expect(image).toMatch(/studio-herrstrom-milkshake-graphic-design-project-itsnicethat-\d+\.(png|gif)$/);
    expect(images.slice(0, 3).map((image) => image.match(/-(\d+)\.\w+$/)?.[1])).toEqual(["1", "2", "3"]);
  });

  it("Brand New → the 2 images of the project, none from other articles", () => {
    const images = galleryOf("brandnew");
    expect(images).toHaveLength(2);
    for (const image of images) expect(image).toMatch(/hard_rock_bet_casino/);
  });

  it("D&AD → the main image once, in its largest size", () => {
    const images = galleryOf("dandad-insights");
    expect(images).toHaveLength(1);
    expect(images[0]).toContain("/131882/");
    expect(images[0]).not.toContain("width-500");
  });
});

describe("findArticleImages — rules", () => {
  const page = (body: string) => `<html><body>${body}</body></html>`;

  it("returns nothing without a main image", () => {
    expect(findArticleImages(page('<img src="/a.jpg">'), "https://example.com/post", null)).toEqual([]);
  });

  it("finds images hidden in page data (escaped JSON)", () => {
    const html = page(
      `<script>window.__DATA__={"gallery":["https:\\/\\/cdn.example.com\\/my-project-name-here-2.jpg"]}</script>`,
    );
    expect(findArticleImages(html, "https://example.com/post", "https://cdn.example.com/my-project-name-here-1.jpg")).toEqual([
      "https://cdn.example.com/my-project-name-here-1.jpg",
      "https://cdn.example.com/my-project-name-here-2.jpg",
    ]);
  });

  it("ignores logos, icons and images of other articles", () => {
    const html = page(`
      <img src="/img/logo.png"><img src="/img/icon-search.png">
      <img src="/img/another-article-cover-photo.jpg">
      <img src="/img/my-project-name-here-2.jpg">`);
    expect(findArticleImages(html, "https://example.com/post", "https://example.com/img/my-project-name-here-1.jpg")).toEqual([
      "https://example.com/img/my-project-name-here-1.jpg",
      "https://example.com/img/my-project-name-here-2.jpg",
    ]);
  });

  it("keeps one size of each image (WordPress-style sizes)", () => {
    const html = page(`<img src="/up/my-project-name-here-2-300x200.jpg"><img src="/up/my-project-name-here-2.jpg">`);
    expect(findArticleImages(html, "https://example.com/post", "https://example.com/up/my-project-name-here-1.jpg")).toHaveLength(2);
  });

  it("recognises cache copies of the same picture (photo-2-54723.webp)", () => {
    const html = page(`<img src="/cache/123/my-project-name-here-2-54723.webp"><img src="/cache/124/my-project-name-here-2-bc9e4.webp">`);
    expect(findArticleImages(html, "https://example.com/post", "https://example.com/up/my-project-name-here-1.jpg")).toHaveLength(2);
  });

  it("keeps at most 12 images", () => {
    const html = page(Array.from({ length: 20 }, (_, i) => `<img src="/up/my-project-name-here-${i + 2}.jpg">`).join(""));
    expect(findArticleImages(html, "https://example.com/post", "https://example.com/up/my-project-name-here-1.jpg")).toHaveLength(12);
  });
});

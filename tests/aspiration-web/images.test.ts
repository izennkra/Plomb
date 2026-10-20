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

describe("generic share pictures", () => {
  it("are recognised (It's Nice That's /images/social.jpg, which is even missing)", async () => {
    const { isGenericImage } = await import("@/modules/aspiration-web/images");
    expect(isGenericImage("https://www.itsnicethat.com/images/social.jpg")).toBe(true);
    expect(isGenericImage("https://example.com/assets/og-image.png")).toBe(true);
    expect(isGenericImage("https://example.com/share-default.jpg")).toBe(true);
    expect(isGenericImage("https://m.itsnicethat.com/original_images/studio-herrstrom-milkshake-1.png")).toBe(false);
    expect(isGenericImage("https://example.com/uploads/socialist-poster-design.jpg")).toBe(false);
  });

  it("an article whose only picture is the generic one has no image", () => {
    const html = '<html><head><meta property="og:title" content="Nicer Tuesdays"><meta property="og:image" content="https://www.itsnicethat.com/images/social.jpg"></head><body><p>Text</p></body></html>';
    const result = readArticle(html, "https://www.itsnicethat.com/articles/nicer-tuesdays");
    expect(result).toMatchObject({ ok: true, post: { imageUrl: null, images: [] } });
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

  it("ignores the site's icons and images of other articles", () => {
    const html = page(`
      <img src="/img/logo.png"><img src="/img/icon-search.png">
      <img src="/img/another-article-cover-photo.jpg">
      <img src="/img/my-project-name-here-2.jpg">`);
    expect(findArticleImages(html, "https://example.com/post", "https://example.com/img/my-project-name-here-1.jpg")).toEqual([
      "https://example.com/img/my-project-name-here-1.jpg",
      "https://example.com/img/my-project-name-here-2.jpg",
    ]);
  });

  it("keeps logos when they are the subject (design media)", () => {
    const html = page(`<img src="/up/ptal_logo_detail.png"><img src="/up/ptal_packaging_06.jpg"><img src="/up/kfc_2026_logo_before_after.png">`);
    const images = findArticleImages(html, "https://example.com/post", "https://example.com/up/ptal_logo_before_after.png");
    expect(images[0]).toBe("https://example.com/up/ptal_logo_before_after.png");
    expect(images.slice(1).sort()).toEqual(["https://example.com/up/ptal_logo_detail.png", "https://example.com/up/ptal_packaging_06.jpg"]);
  });

  it("takes the images stored in a folder named after the article (main image is a video still)", () => {
    const article = "https://example.com/project/hochburgs-identity-for-grill-brand";
    const html = page(`
      <img src="/uploads/articles/2026/10/hochburgs-identity-for-grill-brand/Flamid-01.jpg">
      <img src="/uploads/articles/2026/10/hochburgs-identity-for-grill-brand/Flamid-02.jpg">
      <img src="/uploads/articles/2026/10/another-article-about-something/Other-01.jpg">`);
    expect(findArticleImages(html, article, "https://example.com/uploads/videos/14048168.jpg")).toEqual([
      "https://example.com/uploads/videos/14048168.jpg",
      "https://example.com/uploads/articles/2026/10/hochburgs-identity-for-grill-brand/Flamid-01.jpg",
      "https://example.com/uploads/articles/2026/10/hochburgs-identity-for-grill-brand/Flamid-02.jpg",
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

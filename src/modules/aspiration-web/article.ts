import { Readability } from "@mozilla/readability";
import { load, type CheerioAPI } from "cheerio";
import { parseHTML } from "linkedom";
import { findArticleImages, isGenericImage } from "./images";
import { cleanPostUrl, toDate, toExcerpt, type PostCandidate } from "./post";

export type ArticleResult = { ok: true; post: PostCandidate } | { ok: false; error: string };

const TITLE_SEPARATORS = [" — ", " – ", " | ", " - ", " · "];

/** Reads an article page: OpenGraph (title, summary, image), publication date and full text. */
export function readArticle(html: string, url: string): ArticleResult {
  const $ = load(html);
  const meta = (key: string) =>
    $(`meta[property="${key}"], meta[name="${key}"]`).first().attr("content")?.trim() || undefined;

  const siteName = meta("og:site_name");
  const rawTitle = meta("og:title") ?? meta("twitter:title") ?? ($("title").first().text().trim() || undefined);
  const title = rawTitle ? removeSiteName(rawTitle, siteName) : undefined;
  if (!title) return { ok: false, error: "Pas de titre d'article dans cette page." };

  const content = extractText(html, url);
  const image = meta("og:image") ?? meta("twitter:image");
  const absoluteImage = image ? absolute(image, url) : null;
  // A site-wide share picture (social.jpg…) is not the article's image.
  const imageUrl = absoluteImage && !isGenericImage(absoluteImage) ? absoluteImage : null;
  const images = findArticleImages(html, url, imageUrl);

  return {
    ok: true,
    post: {
      url: cleanPostUrl(url, url) ?? url,
      title,
      excerpt: toExcerpt(meta("og:description") ?? meta("description") ?? content),
      // The largest size of the main image, when the page offers several.
      imageUrl: images[0] ?? imageUrl,
      images,
      publishedAt: findDate($, meta),
      content,
    },
  };
}

/** "Article — The Brand Identity – Home of…" → "Article". */
function removeSiteName(title: string, siteName: string | undefined): string {
  if (siteName) {
    for (const separator of TITLE_SEPARATORS) {
      const index = title.indexOf(`${separator}${siteName}`);
      if (index > 0) return title.slice(0, index).trim();
    }
  }
  return title.trim();
}

function findDate($: CheerioAPI, meta: (key: string) => string | undefined): Date | null {
  const fromMeta = toDate(
    meta("article:published_time") ?? meta("og:published_time") ?? meta("datePublished") ?? meta("date") ?? meta("pubdate"),
  );
  if (fromMeta) return fromMeta;

  for (const script of $('script[type="application/ld+json"]').toArray()) {
    const date = toDate(findJsonLdDate(safeJson($(script).text())));
    if (date) return date;
  }

  const fromItemprop = toDate($('[itemprop="datePublished"]').first().attr("content") ?? $('[itemprop="datePublished"]').first().attr("datetime"));
  if (fromItemprop) return fromItemprop;

  const fromTime = toDate($("article time[datetime], main time[datetime]").first().attr("datetime"));
  if (fromTime) return fromTime;

  // Last resort: an element dedicated to the article date, e.g. <dd id="article-date">20 October 2026</dd>
  for (const element of $('[id*="article-date" i], [class*="article-date" i], [class*="publish" i]').toArray()) {
    const date = toDate($(element).text().trim());
    if (date) return date;
  }
  return null;
}

function findJsonLdDate(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const date = findJsonLdDate(item);
      if (date) return date;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.datePublished === "string") return record.datePublished;
  return findJsonLdDate(record["@graph"]);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Main text of the page (without menus, footers…), for the AI editor. */
function extractText(html: string, url: string): string | null {
  try {
    const { document } = parseHTML(html);
    // Readability needs the page address to resolve links.
    Object.defineProperty(document, "documentURI", { value: url });
    const article = new Readability(document as unknown as Document).parse();
    const text = article?.textContent
      ?.split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n");
    return text || null;
  } catch {
    return null;
  }
}

function absolute(src: string, base: string): string | null {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

import { extractFromXml } from "@extractus/feed-extractor";
import { load } from "cheerio";
import { findContentImages } from "./images";
import { cleanPostUrl, htmlToText, toDate, toExcerpt, type PostCandidate } from "./post";

const FEED_TYPES = ["application/rss+xml", "application/atom+xml", "application/feed+json", "application/json"];

/** Feeds that are not articles. */
const IGNORED_FEED = /podcast|comments/i;

/**
 * Feed addresses for a page: those it announces in its HTML, and usual addresses to try otherwise.
 */
export function findFeedUrls(html: string, pageUrl: string): { announced: string[]; guessed: string[] } {
  const $ = load(html);
  const announced = new Set<string>();
  $('link[rel~="alternate"]').each((_, element) => {
    const link = $(element);
    const type = (link.attr("type") ?? "").toLowerCase();
    const href = link.attr("href");
    if (!href || !FEED_TYPES.includes(type)) return;
    if (IGNORED_FEED.test(link.attr("title") ?? "") || IGNORED_FEED.test(href)) return;
    const url = cleanPostUrl(href, pageUrl);
    if (url) announced.add(url);
  });

  const { origin, pathname } = new URL(pageUrl);
  const path = pathname.replace(/\/+$/, "");
  const guessed = new Set([...(path ? [`${origin}${path}/feed`] : []), `${origin}/feed`, `${origin}/rss.xml`]);
  for (const url of announced) guessed.delete(url);

  return { announced: [...announced], guessed: [...guessed] };
}

export type FeedResult = { ok: true; posts: PostCandidate[] } | { ok: false; error: string };

/** Reads an RSS / Atom / RDF feed. Anything else (an HTML page…) is refused. */
export function parseFeed(xml: string, feedUrl: string): FeedResult {
  if (!/^\s*(<\?xml|<rss|<feed|<rdf:RDF)/i.test(xml)) {
    return { ok: false, error: "Ce n'est pas un flux RSS." };
  }

  let entries;
  try {
    entries =
      extractFromXml(xml, {
        descriptionMaxLen: 0,
        baseUrl: feedUrl,
        getExtraEntryFields: (entry) => ({ raw: entry }),
      }).entries ?? [];
  } catch {
    return { ok: false, error: "Flux RSS illisible." };
  }

  const posts: PostCandidate[] = [];
  for (const entry of entries) {
    const url = entry.link ? cleanPostUrl(entry.link, feedUrl) : null;
    const title = entry.title?.trim();
    if (!url || !title) continue;

    const raw = (entry.raw ?? {}) as Record<string, unknown>;
    const html = stringField(raw["content:encoded"]) ?? stringField(raw.content) ?? null;
    const imageUrl = findImage(raw, html ?? entry.description ?? "", feedUrl);
    posts.push({
      url,
      title,
      excerpt: toExcerpt(entry.description ? htmlToText(entry.description) : null),
      imageUrl,
      images: findContentImages(html ?? entry.description ?? "", feedUrl, imageUrl),
      publishedAt: toDate(entry.published),
      content: html ? htmlToText(html) : null,
    });
  }

  if (posts.length === 0) return { ok: false, error: "Le flux RSS ne contient aucun article." };
  return { ok: true, posts };
}

/** Image from enclosure / media tags, otherwise the first image in the content. */
function findImage(raw: Record<string, unknown>, html: string, base: string): string | null {
  for (const field of ["enclosure", "media:content", "media:thumbnail"]) {
    for (const media of asArray(raw[field])) {
      const url = attribute(media, "url");
      const type = attribute(media, "type") ?? "";
      const medium = attribute(media, "medium") ?? "";
      const isImage = field === "media:thumbnail" || type.startsWith("image/") || medium === "image";
      if (url && isImage) return absoluteUrl(url, base);
    }
  }
  const src = load(html)("img").first().attr("src");
  return src ? absoluteUrl(src, base) : null;
}

function absoluteUrl(src: string, base: string): string | null {
  try {
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function attribute(value: unknown, name: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const found = (value as Record<string, unknown>)[`@_${name}`];
  return typeof found === "string" ? found : undefined;
}

function stringField(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { "#text"?: unknown })["#text"] === "string") {
    return (value as { "#text": string })["#text"];
  }
  return undefined;
}

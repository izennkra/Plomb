import { load } from "cheerio";
import { isGenericImage } from "./images";
import { cleanPostUrl, type PostCandidate } from "./post";

/** An article address ends with a descriptive slug: "studio-hi-ho-pairs-kraft-and-butter…". */
const MIN_SLUG_WORDS = 4;
/** A family of addresses (/project/…) must repeat to be a list of articles, not a one-off link. */
const MIN_FAMILY_SIZE = 3;
/** …and weigh enough next to the main family: a few long one-off pages (statements, showcases) are not news. */
const MIN_SHARE_OF_LARGEST_FAMILY = 0.3;
/** Families that list things other than articles. */
const NOT_ARTICLES = /^(category|categories|tag|tags|topic|topics|author|authors|page|search|shop|store|cart|account|login|feed)$/i;

/**
 * Article addresses found on a listing page (home page, section…), in page order.
 * Used when the site has no RSS feed.
 */
export function findArticleLinks(html: string, pageUrl: string): string[] {
  const $ = load(html);
  const page = new URL(pageUrl);
  const self = cleanPostUrl(pageUrl, pageUrl);
  const families = new Map<string, string[]>();
  const order: string[] = [];

  $("a[href]").each((_, element) => {
    const url = cleanPostUrl($(element).attr("href") ?? "", pageUrl);
    if (!url || url === self) return;
    const { hostname, pathname } = new URL(url);
    if (hostname !== page.hostname.toLowerCase()) return;

    const segments = pathname.split("/").filter(Boolean);
    const slug = segments.at(-1);
    if (!slug || !looksLikeArticleSlug(slug)) return;
    if (segments.slice(0, -1).some((segment) => NOT_ARTICLES.test(segment))) return;

    const family = segments.slice(0, -1).join("/");
    const members = families.get(family) ?? [];
    if (!members.includes(url)) {
      members.push(url);
      families.set(family, members);
      order.push(url);
    }
  });

  const largest = Math.max(0, ...[...families.values()].map((members) => members.length));
  const minSize = Math.max(MIN_FAMILY_SIZE, Math.ceil(largest * MIN_SHARE_OF_LARGEST_FAMILY));
  const kept = new Set([...families.values()].filter((members) => members.length >= minSize).flat());
  return order.filter((url) => kept.has(url));
}

function looksLikeArticleSlug(slug: string): boolean {
  const words = decodeURIComponent(slug)
    .replace(/\.(php|html?|aspx?)$/i, "")
    .split(/[-_\s]+/)
    .filter(Boolean);
  return words.length >= MIN_SLUG_WORDS;
}

/**
 * When an article's own page refuses Plomb (anti-robot protection), its card on the list page still gives its title,
 * its image and its link: the article is kept, shown with what the site itself displays on its list.
 */
export function readCard(html: string, pageUrl: string, url: string): PostCandidate | null {
  const $ = load(html);
  const anchors = $("a[href]").filter((_, element) => cleanPostUrl($(element).attr("href") ?? "", pageUrl) === url);
  if (anchors.length === 0) return null;

  const clean = (text: string | undefined) => (text ?? "").replace(/\s+/g, " ").trim();
  // In this order: the headings of the card (the longest is the title, "Project" is only a label), the image's
  // description, the text of the link.
  const longest = (texts: string[]) => texts.filter((text) => text.length >= 10).sort((a, b) => b.length - a.length)[0];
  const title =
    longest(anchors.find("h1, h2, h3, h4, h5, h6").map((_, heading) => clean($(heading).text())).get()) ??
    longest(anchors.find("img[alt]").map((_, image) => clean($(image).attr("alt"))).get()) ??
    longest(anchors.map((_, anchor) => clean($(anchor).text())).get());
  if (!title) return null;

  const absolute = (src: string | undefined) => {
    if (!src || src.startsWith("data:")) return null;
    try {
      return new URL(src, pageUrl).toString();
    } catch {
      return null;
    }
  };
  const largestOf = (srcset: string | undefined) =>
    srcset
      ?.split(",")
      .map((entry) => entry.trim().split(/\s+/))
      .sort((a, b) => parseInt(b[1] ?? "0") - parseInt(a[1] ?? "0"))[0]?.[0];
  const images = [
    ...anchors.find("img").map((_, image) => absolute(largestOf($(image).attr("srcset")) ?? $(image).attr("src"))).get(),
    ...anchors.find("video[poster]").map((_, video) => absolute($(video).attr("poster"))).get(),
  ].filter((src): src is string => Boolean(src) && !isGenericImage(src!));
  const unique = [...new Set(images)];

  return { url, title: title.slice(0, 300), excerpt: null, imageUrl: unique[0] ?? null, images: unique, publishedAt: null, content: null };
}

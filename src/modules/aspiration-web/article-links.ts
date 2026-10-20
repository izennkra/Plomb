import { load } from "cheerio";
import { cleanPostUrl } from "./post";

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

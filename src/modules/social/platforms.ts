import type { Source } from "@/db/schema";
import { cleanPostUrl, toDate, toExcerpt, type PostCandidate } from "@/modules/aspiration-web/post";

/**
 * How one social network is read through Apify: which scraper, what to ask for several accounts at once (one request
 * per network saves money), and how to give each account its own posts back.
 */
export type Platform = {
  actor: string;
  /** Check times (Paris, decimal hours); default: the four daily checks. */
  hours?: number[];
  /** `since`: only posts published after this date; none = first relève (a few recent posts as a starting point). */
  input(sources: Source[], since: Date | null): object;
  /** The posts of the answer that belong to this account, read as Plomb articles. */
  read(items: unknown[], source: Source): PostCandidate[];
};

/** First relève: a few posts, as a starting point (like the 20 articles of a website). */
const FIRST_POSTS = 3;
const MAX_POSTS = 10;
const MAX_TITLE = 110;
const MAX_IMAGES = 12;

type Item = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");
const arr = (value: unknown): Item[] => (Array.isArray(value) ? (value as Item[]) : []);

/** First sentence-like line of a caption, without links, as the card's title. */
export function titleFrom(text: string, fallback: string): string {
  const line =
    text
      .split("\n")
      .map((l) => l.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim())
      .find((l) => l.replace(/[#@][\w.]+/g, "").trim().length > 0) ?? "";
  if (!line) return fallback;
  return line.length > MAX_TITLE ? `${line.slice(0, MAX_TITLE - 1).trimEnd()}…` : line;
}

const unique = (urls: string[]) => [...new Set(urls.filter(Boolean))].slice(0, MAX_IMAGES);

const handleOf = (source: Source) => source.key.split(":")[1] ?? "";
const same = (a: unknown, b: string) => str(a).toLowerCase() === b.toLowerCase();

export const instagram: Platform = {
  actor: "apify/instagram-post-scraper",
  // Instagram bills even an empty answer (~0.27 cent per account): twice a day keeps it within the free credit
  // (Izenn, 2026-10-20). 7:30 is in time for the 8:00 edition.
  hours: [7.5, 15.5],
  input: (sources, since) => ({
    username: sources.map(handleOf),
    resultsLimit: since ? MAX_POSTS : FIRST_POSTS,
    skipPinnedPosts: true,
    ...(since ? { onlyPostsNewerThan: since.toISOString() } : {}),
  }),
  read: (items, source) =>
    arr(items)
      .filter((item) => same(item.ownerUsername, handleOf(source)))
      .flatMap((item) => {
      const url = cleanPostUrl(str(item.url), "https://www.instagram.com/");
      if (!url) return [];
      const caption = str(item.caption);
      // A carousel ("Sidecar") gives every slide; otherwise the single picture (or the video's cover).
      const slides = arr(item.childPosts).map((child) => str(child.displayUrl));
      const images = unique(slides.length ? slides : [...arr(item.images).map((i) => (typeof i === "string" ? i : "")), str(item.displayUrl)]);
      return [
        {
          url,
          title: titleFrom(caption, `Nouveau post de ${source.displayName}`),
          excerpt: toExcerpt(caption),
          imageUrl: images[0] ?? null,
          images,
          publishedAt: toDate(item.timestamp),
          content: caption || null,
        },
      ];
    }),
};

export const x: Platform = {
  actor: "kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest",
  // One search for every account (the scraper bills at least 20 tweets per request, whatever the number of accounts).
  input: (sources, since) => ({
    searchTerms: [
      `(${sources.map((source) => `from:${handleOf(source)}`).join(" OR ")})${since ? ` since_time:${Math.floor(since.getTime() / 1000)}` : ""}`,
    ],
    queryType: "Latest",
    maxItems: Math.max(20, sources.length * (since ? MAX_POSTS : FIRST_POSTS)),
  }),
  read: (items, source) =>
    arr(items)
      // This account's own tweets only: no retweets, no replies.
      .filter((item) => same((item.author as Item | undefined)?.userName, handleOf(source)))
      .filter((item) => !item.retweeted_tweet && !item.isReply)
      .slice(0, MAX_POSTS)
      .flatMap((item) => {
        const url = cleanPostUrl(str(item.url) || str(item.twitterUrl), "https://x.com/");
        if (!url) return [];
        const text = str(item.text);
        const media = arr((item.extendedEntities as Item | undefined)?.media);
        const images = unique(media.filter((m) => m.type !== "video" || m.media_url_https).map((m) => str(m.media_url_https)));
        return [
          {
            url: url.replace("://twitter.com/", "://x.com/"),
            title: titleFrom(text, `Nouveau post de ${source.displayName}`),
            excerpt: toExcerpt(text.replace(/https:\/\/t\.co\/\S+/g, "").trim()),
            imageUrl: images[0] ?? null,
            images,
            publishedAt: toDate(item.createdAt),
            content: text || null,
          },
        ];
      }),
};

export const linkedin: Platform = {
  actor: "harvestapi/linkedin-company-posts",
  input: (sources, since) => ({
    targetUrls: sources.map((source) => source.url),
    maxPosts: since ? MAX_POSTS : FIRST_POSTS,
    includeReposts: false,
    ...(since ? { postedLimitDate: since.toISOString() } : {}),
  }),
  read: (items, source) =>
    arr(items)
      .filter((item) => belongsToLinkedIn(item, source))
      .flatMap((item) => {
      const url = cleanPostUrl(str(item.linkedinUrl) || str(item.shareUrl), "https://www.linkedin.com/");
      if (!url) return [];
      const text = str(item.content);
      const images = unique(arr(item.postImages).map((image) => str(image.url)));
      return [
        {
          url,
          title: titleFrom(text, `Nouveau post de ${source.displayName}`),
          excerpt: toExcerpt(text),
          imageUrl: images[0] ?? null,
          images,
          publishedAt: toDate((item.postedAt as Item | undefined)?.date),
          content: text || null,
        },
      ];
    }),
};

/** The answer says which page was asked (query.targetUrl) and who wrote (author.universalName / publicIdentifier). */
function belongsToLinkedIn(item: Item, source: Source): boolean {
  const slug = source.key.split("/").pop() ?? "";
  const target = str((item.query as Item | undefined)?.targetUrl).replace(/\/+$/, "").toLowerCase();
  const author = item.author as Item | undefined;
  return target.endsWith(`/${slug}`) || same(author?.universalName, slug) || same(author?.publicIdentifier, slug);
}

/** LinkedIn people (linkedin.com/in/…) use the profile scraper, with the same answers. */
const linkedinProfile: Platform = { ...linkedin, actor: "harvestapi/linkedin-profile-posts" };

export function platformOf(source: Source): Platform | null {
  if (source.type === "instagram") return instagram;
  if (source.type === "x") return x;
  if (source.type === "linkedin") return source.key.startsWith("linkedin:in/") ? linkedinProfile : linkedin;
  return null;
}

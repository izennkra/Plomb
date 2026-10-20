import { load } from "cheerio";
import { findFeedUrls } from "./feed";

const FEED_BASE = "https://www.youtube.com/feeds/videos.xml?channel_id=";

/**
 * Every YouTube channel has an official, free RSS feed of its latest videos. Found on the channel page: announced
 * feed, otherwise built from the channel id. Null when the page is not a channel.
 */
export function findYoutubeFeed(html: string): { feedUrl: string; name: string | null } | null {
  const announced = findFeedUrls(html, "https://www.youtube.com/").announced.find((url) => url.startsWith(FEED_BASE));
  const channelId = /"(?:externalId|channelId)":"(UC[\w-]{10,})"/.exec(html)?.[1];
  const feedUrl = announced ?? (channelId ? `${FEED_BASE}${channelId}` : null);
  if (!feedUrl) return null;
  const name = load(html)('meta[property="og:title"]').attr("content")?.trim() || null;
  return { feedUrl, name };
}

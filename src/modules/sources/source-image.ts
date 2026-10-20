import { load } from "cheerio";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sources, type Source } from "@/db/schema";
import type { PageFetcher } from "@/modules/fetching/polite-fetch";
import { safeFetch } from "@/modules/fetching/safe-fetch";
import { mediaName, type MediaStore } from "@/modules/social/media-store";

/** A source without picture is looked for again after this. */
const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 2_000_000;

export type DownloadImage = (url: string) => Promise<{ bytes: Uint8Array; contentType: string } | null>;

/**
 * The icon of a website, from its home page: the "apple-touch-icon" (a square logo, made for home screens), else the
 * largest declared icon, else its sharing image. Vector icons (SVG) are left aside: they could carry scripts.
 */
export function findSiteIcon(html: string, pageUrl: string): string | null {
  const $ = load(html);
  const absolute = (href: string | undefined) => {
    if (!href || href.startsWith("data:")) return null;
    try {
      const url = new URL(href, pageUrl).toString();
      return /\.svg(\?|$)/i.test(url) ? null : url;
    } catch {
      return null;
    }
  };
  const size = (sizes: string | undefined) => Math.max(0, ...(sizes ?? "").split(/\s+/).map((value) => parseInt(value) || 0));

  const touch = $('link[rel~="apple-touch-icon"], link[rel~="apple-touch-icon-precomposed"]')
    .toArray()
    .map((link) => ({ url: absolute($(link).attr("href")), size: size($(link).attr("sizes")) || 180 }));
  const icons = $('link[rel~="icon"]')
    .toArray()
    .map((link) => ({ url: absolute($(link).attr("href")), size: size($(link).attr("sizes")) }));
  const best = [...touch, ...icons.filter((icon) => icon.size >= 96)]
    .filter((icon) => icon.url)
    .sort((a, b) => b.size - a.size)[0];
  if (best?.url) return best.url;
  return absolute($('meta[property="og:image"]').attr("content")) ?? icons.find((icon) => icon.url)?.url ?? null;
}

/** The profile picture of an X or LinkedIn account, found in the posts Apify brings back. */
export function avatarFromItems(source: Pick<Source, "type">, items: unknown[]): string | null {
  for (const item of items as Record<string, unknown>[]) {
    const author = item?.author as Record<string, unknown> | undefined;
    if (!author) continue;
    if (source.type === "x" && typeof author.profilePicture === "string") {
      return author.profilePicture.replace("_normal.", "_400x400.");
    }
    const avatar = author.avatar as { url?: unknown } | undefined;
    if (source.type === "linkedin" && typeof avatar?.url === "string") return avatar.url;
  }
  return null;
}

/** Instagram pages are closed to servers: the free unavatar.io service gives the public profile picture. */
export function unavatarUrl(source: Pick<Source, "type" | "key">): string | null {
  const handle = source.key.split(":")[1];
  if (!handle) return null;
  if (source.type === "instagram") return `https://unavatar.io/instagram/${encodeURIComponent(handle)}?fallback=false`;
  if (source.type === "x") return `https://unavatar.io/x/${encodeURIComponent(handle)}?fallback=false`;
  return null;
}

const download: DownloadImage = async (url) => {
  const response = await safeFetch(url, { binary: true, maxBytes: MAX_IMAGE_BYTES, headers: { accept: "image/*" } });
  if (!response.ok || response.status !== 200 || !response.bytes) return null;
  if (!response.contentType.startsWith("image/") || response.contentType.includes("svg")) return null;
  return { bytes: response.bytes, contentType: response.contentType };
};

/** Copies the picture into Plomb (the original addresses of social networks expire) and records it on the source. */
export async function saveSourceImage(
  db: Db,
  sourceId: number,
  url: string,
  { mediaStore, fetchImage = download, now = new Date() }: { mediaStore: MediaStore; fetchImage?: DownloadImage; now?: Date },
): Promise<string | null> {
  const image = await fetchImage(url).catch(() => null);
  const saved = image ? await mediaStore.save(mediaName(url, image.contentType), image.bytes, image.contentType) : null;
  await db.update(sources).set({ imageUrl: saved, imageCheckedAt: now }).where(eq(sources.id, sourceId));
  return saved;
}

/**
 * Finds the pictures still missing (a few per call): the site's icon, the YouTube channel's picture, the Instagram
 * or X profile picture. Without one, the tile shows the source's initials.
 */
export async function refreshSourceImages(
  db: Db,
  {
    fetchPage,
    mediaStore,
    fetchImage,
    now = new Date(),
    max = 5,
  }: { fetchPage: PageFetcher; mediaStore: MediaStore; fetchImage?: DownloadImage; now?: Date; max?: number },
): Promise<number> {
  const missing = await db
    .select()
    .from(sources)
    .where(
      and(
        isNull(sources.imageUrl),
        or(isNull(sources.imageCheckedAt), lt(sources.imageCheckedAt, new Date(now.getTime() - RETRY_AFTER_MS))),
      ),
    )
    .limit(max);

  let found = 0;
  for (const source of missing) {
    let candidate: string | null = null;
    if (source.type === "web" || source.type === "youtube") {
      const home = source.type === "web" ? new URL(source.url).origin : source.url;
      const page = await fetchPage(home).catch(() => null);
      if (page?.ok && page.status === 200) candidate = findSiteIcon(page.body, page.url);
    } else {
      candidate = unavatarUrl(source);
    }
    const saved = candidate ? await saveSourceImage(db, source.id, candidate, { mediaStore, fetchImage, now }) : null;
    if (!candidate) await db.update(sources).set({ imageCheckedAt: now }).where(eq(sources.id, source.id));
    if (saved) found++;
  }
  return found;
}

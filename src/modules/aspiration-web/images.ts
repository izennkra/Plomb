import { load } from "cheerio";

/** Images in a card's carousel: enough to see a project, not a whole photo shoot. */
export const MAX_GALLERY_IMAGES = 12;

const IMAGE_URL = /https?:\/\/[^\s"'()<>\\]+?\.(?:jpe?g|png|webp|gif|avif)(?:\?[^\s"'()<>\\]*)?(?=[\s"'()<>\\]|$)/gi;
/** Site furniture, not article content. */
const NOT_CONTENT = /logo|icon|favicon|avatar|sprite|placeholder|spinner|badge|apple-touch|social|share|pixel|blank|spacer/i;
const SIZE_SUFFIX = /-\d{2,4}x\d{2,4}$/;
/** Cache copies add a code to the name (photo-01-54723.webp, photo-01-bc9e4.webp): same picture as photo-01.jpg. */
const CACHE_SUFFIX = /[-_][0-9a-f]{5,}$/;

/**
 * Images belonging to the article: the main image (og:image) and its "family" — same folder when the folder is
 * dedicated to the article, or same base name (project-name-1.jpg, project-name-2.jpg…). Images of other articles
 * shown on the page ("read also") don't share that family and are left out.
 */
export function findArticleImages(html: string, pageUrl: string, mainImage: string | null): string[] {
  if (!mainImage) return [];
  const main = parse(mainImage);
  if (!main) return [];

  // One entry per picture (same base name = same picture in another size): keep its largest size.
  const pictures = new Map<string, Candidate>();
  const add = (candidate: Candidate) => {
    const current = pictures.get(candidate.key);
    if (!current || candidate.size > current.size) pictures.set(candidate.key, { ...candidate, order: current?.order ?? candidate.order });
  };

  let order = 0;
  for (const url of collectImageUrls(html, pageUrl)) {
    const candidate = parse(url, ++order);
    if (candidate && (candidate.key === main.key || isSameFamily(candidate, main))) add(candidate);
  }
  add({ ...main, order: 0, size: Math.max(main.size, pictures.get(main.key)?.size ?? 0) });
  const mainUrl = pictures.get(main.key)!.url;

  const others = [...pictures.values()]
    .filter((picture) => picture.key !== main.key)
    .sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity) || a.order - b.order);
  return [mainUrl, ...others.map((picture) => picture.url)].slice(0, MAX_GALLERY_IMAGES);
}

/**
 * Gallery of an article from an RSS feed: the feed's image, then the images of the article content
 * (without icons, buttons or tiny tracking images).
 */
export function findContentImages(html: string, base: string, mainImage: string | null): string[] {
  const $ = load(html);
  const urls = mainImage ? [mainImage] : [];
  $("img").each((_, element) => {
    const node = $(element);
    const tiny = [node.attr("width"), node.attr("height")].some((value) => value !== undefined && Number(value) < 100);
    const src = node.attr("src");
    if (!src || src.startsWith("data:") || tiny || NOT_CONTENT.test(src)) return;
    try {
      urls.push(new URL(src, base).toString());
    } catch {
      // not an address
    }
  });
  return [...new Set(urls)].slice(0, MAX_GALLERY_IMAGES);
}

type Candidate = {
  url: string;
  /** Same key = same picture, maybe in another size. */
  key: string;
  folder: string;
  stem: string[];
  /** Trailing number of the file name (project-3.jpg → 3), to keep the article's order. */
  number: number | null;
  size: number;
  order: number;
};

function parse(url: string, order = 0): Candidate | null {
  let parsed: URL;
  try {
    parsed = new URL(url.replace(/&amp;/g, "&"));
  } catch {
    return null;
  }
  const segments = decodeURIComponent(parsed.pathname).split("/").filter(Boolean);
  const file = segments.at(-1);
  if (!file || NOT_CONTENT.test(file)) return null;

  const name = file.replace(/\.\w+$/, "").replace(SIZE_SUFFIX, "").toLowerCase();
  const isCacheCopy = CACHE_SUFFIX.test(name);
  const base = name.replace(CACHE_SUFFIX, "");
  const tokens = base.split(/[-_.\s]+/).filter(Boolean);
  const last = tokens.at(-1);
  const number = last && /^\d{1,3}$/.test(last) ? Number(last) : null;
  return {
    url: `${parsed.origin}${parsed.pathname}`,
    key: `${parsed.hostname}/${base}`,
    folder: `${parsed.hostname}/${segments.slice(0, -1).join("/")}`,
    stem: number === null ? tokens : tokens.slice(0, -1),
    number,
    // Prefer the original file over its cache copies.
    size: isCacheCopy ? Math.min(sizeHint(url), 5_000) : sizeHint(url),
    order,
  };
}

function isSameFamily(candidate: Candidate, main: Candidate): boolean {
  // A folder named after the article (…/studio-hi-ho-pairs-kraft-and-butter…/) only holds that article's images.
  const folderName = main.folder.split("/").at(-1) ?? "";
  if (candidate.folder === main.folder && folderName.split(/[-_]+/).length >= 3) return true;

  // Same base name: studio-herrstrom-milkshake-…-1.png and …-2.png, hard_rock_bet_casino_new / _advertising_01.
  const needed = Math.max(2, main.stem.length - 2);
  let common = 0;
  while (common < main.stem.length && candidate.stem[common] === main.stem[common]) common++;
  return common >= needed;
}

/** Width hinted by the address (width-1600, -1200x800, ?w=1600, class=w1440): bigger is better. */
function sizeHint(url: string): number {
  const decoded = decodeURIComponent(url);
  const match =
    /width-(\d+)/i.exec(decoded) ?? /-(\d{2,4})x\d{2,4}\./.exec(decoded) ?? /[?&]w=(\d+)/.exec(decoded) ?? /class=w(\d+)/.exec(decoded);
  // No size in the address usually means the original file.
  return match ? Number(match[1]) : 10_000;
}

/** Every image address in the page: tags, srcset, and data hidden in scripts (escaped JSON). */
function collectImageUrls(html: string, pageUrl: string): string[] {
  const urls: string[] = [];
  const $ = load(html);
  $("img, source").each((_, element) => {
    const node = $(element);
    const values = [node.attr("src"), node.attr("data-src"), node.attr("srcset"), node.attr("data-srcset")];
    for (const value of values) {
      for (const part of value?.split(",") ?? []) {
        const src = part.trim().split(/\s+/)[0];
        if (!src || src.startsWith("data:")) continue;
        try {
          urls.push(new URL(src, pageUrl).toString());
        } catch {
          // not an address
        }
      }
    }
  });

  const unescaped = html.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");
  for (const match of unescaped.matchAll(IMAGE_URL)) urls.push(match[0]);
  return urls;
}

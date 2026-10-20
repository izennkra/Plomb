import { load } from "cheerio";
import { TRACKING_PARAMS } from "@/modules/sources/parse-url";

/** An article found on a source, before it is stored. Every level of the cascade produces this. */
export type PostCandidate = {
  url: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  /** Full text for the AI editor (never displayed). */
  content: string | null;
};

const EXCERPT_MAX_LENGTH = 300;

/** Absolute address without anchor, tracking parameters or trailing slash: one article = one address. */
export function cleanPostUrl(href: string, base: string): string | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.hash = "";
  for (const name of [...url.searchParams.keys()]) {
    if (name.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(name.toLowerCase())) url.searchParams.delete(name);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

/** Readable plain text from HTML, keeping paragraph breaks. */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|figure|figcaption|section|article|tr)>/gi, "$&\n\n");
  const $ = load(withBreaks);
  $("script, style, noscript").remove();
  return $.root()
    .text()
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toExcerpt(text: string | null | undefined): string | null {
  const clean = text?.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > EXCERPT_MAX_LENGTH ? `${clean.slice(0, EXCERPT_MAX_LENGTH - 1).trimEnd()}…` : clean;
}

export function toDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

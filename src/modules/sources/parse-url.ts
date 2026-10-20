export type SourceType = "web" | "instagram" | "x" | "linkedin";

export type ParsedSource = {
  type: SourceType;
  /** Name shown to the user, e.g. "@mouthwash.studio" or "the-brandidentity.com". */
  displayName: string;
  /** Canonical address used to reach the source. */
  url: string;
  /** Unique key: two URLs pointing to the same source share the same key. */
  key: string;
};

export type ParseResult = { ok: true; source: ParsedSource } | { ok: false; error: string };

const ERRORS = {
  empty: "Collez l'adresse d'une source (site, Instagram, X ou LinkedIn).",
  invalid: "Ce n'est pas une adresse valide. Exemple : the-brandidentity.com ou instagram.com/mouthwash.studio",
  notAProfile: (network: string) =>
    `Ce lien ${network} ne pointe pas vers un profil. Collez le lien de la page du compte.`,
};

/** Query parameters that only track where a click came from. */
const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "igsh", "igshid", "hl", "ref", "ref_src", "ref_url",
  "si", "mc_cid", "mc_eid", "_ga", "yclid",
]);

const INSTAGRAM_RESERVED = new Set([
  "p", "reel", "reels", "stories", "explore", "accounts", "tv", "direct", "about", "legal", "developer",
]);

const X_RESERVED = new Set([
  "home", "explore", "search", "i", "notifications", "messages", "settings", "intent", "share",
  "hashtag", "compose", "login", "signup", "tos", "privacy",
]);

const success = (source: ParsedSource): ParseResult => ({ ok: true, source });
const failure = (error: string): ParseResult => ({ ok: false, error });

export function parseSourceUrl(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return failure(ERRORS.empty);

  const url = toUrl(trimmed);
  if (!url) return failure(ERRORS.invalid);

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "instagram.com" || host.endsWith(".instagram.com")) return parseInstagram(segments);
  if (["x.com", "twitter.com", "mobile.twitter.com", "mobile.x.com"].includes(host)) return parseX(segments);
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) return parseLinkedIn(segments);
  return parseWeb(url, host);
}

function toUrl(input: string): URL | null {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input);
  try {
    const url = new URL(hasScheme ? input : `https://${input}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

function parseInstagram(segments: string[]): ParseResult {
  const account = segments[0];
  if (!account || INSTAGRAM_RESERVED.has(account.toLowerCase()) || !/^[A-Za-z0-9._]{1,30}$/.test(account)) {
    return failure(ERRORS.notAProfile("Instagram"));
  }
  const name = account.toLowerCase();
  return success({
    type: "instagram",
    displayName: `@${name}`,
    url: `https://www.instagram.com/${name}`,
    key: `instagram:${name}`,
  });
}

function parseX(segments: string[]): ParseResult {
  const handle = segments[0];
  if (!handle || X_RESERVED.has(handle.toLowerCase()) || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return failure(ERRORS.notAProfile("X"));
  }
  return success({
    type: "x",
    displayName: `@${handle}`,
    url: `https://x.com/${handle}`,
    key: `x:${handle.toLowerCase()}`,
  });
}

function parseLinkedIn(segments: string[]): ParseResult {
  const [kind, name] = segments;
  if ((kind !== "company" && kind !== "in") || !name) {
    return failure(ERRORS.notAProfile("LinkedIn"));
  }
  const slug = decodeURIComponent(name).toLowerCase();
  return success({
    type: "linkedin",
    displayName: slug,
    url: `https://www.linkedin.com/${kind}/${slug}`,
    key: `linkedin:${kind}/${slug}`,
  });
}

function parseWeb(url: URL, host: string): ParseResult {
  const path = url.pathname.replace(/\/+$/, "");
  const params = [...url.searchParams]
    .filter(([name]) => !name.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(name.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params)}` : "";
  const location = `${host}${path}${query}`;

  return success({
    type: "web",
    displayName: host,
    url: `${url.protocol}//${location}`,
    key: `web:${location}`,
  });
}

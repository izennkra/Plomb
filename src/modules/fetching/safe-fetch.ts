import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isPublicIp } from "./ip";

export type Lookup = (host: string) => Promise<{ address: string; family: number }[]>;

export type FetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** false: only the status matters, the page is not downloaded. */
  readBody?: boolean;
  headers?: Record<string, string>;
  /** Tests only: let local test servers through. */
  allowInternal?: boolean | ((host: string) => boolean);
  lookup?: Lookup;
};

export type FetchResult =
  | { ok: true; url: string; status: number; contentType: string; body: string }
  | { ok: false; reason: FetchFailure; error: string };

export type FetchFailure = "invalid" | "blocked" | "timeout" | "unreachable" | "too-large" | "too-many-redirects";

export const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

const MESSAGES: Record<FetchFailure, string> = {
  invalid: "Cette adresse n'est pas valide.",
  blocked: "Plomb ne contacte pas les adresses internes (réseau local, serveur).",
  timeout: "Le site ne répond pas. Réessayez plus tard.",
  unreachable: "Impossible de joindre ce site. Vérifiez l'adresse.",
  "too-large": "La page est trop lourde pour être lue.",
  "too-many-redirects": "Le site redirige trop de fois.",
};

const fail = (reason: FetchFailure): FetchResult => ({ ok: false, reason, error: MESSAGES[reason] });

const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true });

/**
 * The only way Plomb reaches the internet: refuses internal addresses (also after redirects),
 * and limits time and size.
 */
export async function safeFetch(
  input: string,
  {
    timeoutMs = 10_000,
    maxBytes = 5_000_000,
    maxRedirects = 5,
    readBody = true,
    headers = BROWSER_HEADERS,
    allowInternal = false,
    lookup = defaultLookup,
  }: FetchOptions = {},
): Promise<FetchResult> {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = input;

  try {
    for (let redirects = 0; ; redirects++) {
      const parsed = parseHttpUrl(url);
      if (!parsed) return fail("invalid");
      const check = await checkHost(parsed.hostname, allowInternal, lookup);
      if (check) return fail(check);

      const response = await fetch(parsed, { headers, redirect: "manual", signal });
      const location = response.headers.get("location");
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel();
        if (redirects >= maxRedirects) return fail("too-many-redirects");
        url = new URL(location, parsed).toString();
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!readBody) {
        await response.body?.cancel();
        return { ok: true, url, status: response.status, contentType, body: "" };
      }
      const body = await readLimited(response, maxBytes);
      if (body === null) return fail("too-large");
      return { ok: true, url, status: response.status, contentType, body };
    }
  } catch (error) {
    if (signal.aborted) return fail("timeout");
    if (error instanceof DOMException && error.name === "TimeoutError") return fail("timeout");
    return fail("unreachable");
  }
}

function parseHttpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

async function checkHost(
  hostname: string,
  allowInternal: FetchOptions["allowInternal"],
  lookup: Lookup,
): Promise<FetchFailure | null> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (allowInternal === true || (typeof allowInternal === "function" && allowInternal(host))) return null;

  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host)).map((entry) => entry.address);
    } catch {
      return "unreachable";
    }
  }
  return addresses.length > 0 && addresses.every(isPublicIp) ? null : "blocked";
}

/** Reads the body as text, or returns null as soon as it exceeds maxBytes. */
async function readLimited(response: Response, maxBytes: number): Promise<string | null> {
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return "";

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maxBytes) {
      await response.body.cancel().catch(() => {});
      return null;
    }
    chunks.push(chunk);
  }
  const charset = /charset=([\w-]+)/i.exec(response.headers.get("content-type") ?? "")?.[1] ?? "utf-8";
  return decode(Buffer.concat(chunks), charset);
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

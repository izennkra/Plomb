export type WebsiteCheck = { ok: true; finalUrl: string } | { ok: false; error: string };

export type CheckWebsite = (url: string) => Promise<WebsiteCheck>;

const DEFAULT_TIMEOUT_MS = 10_000;

/** Statuses meaning "the site exists but refuses robots": the source is still accepted. */
const PROTECTED_STATUSES = new Set([401, 403, 429]);

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

/** Contacts a website to make sure it exists, following redirects. */
export async function checkWebsite(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<WebsiteCheck> {
  let response: Response;
  try {
    response = await fetch(url, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, error: `Le site ne répond pas (plus de ${Math.round(timeoutMs / 1000)} secondes). Réessayez plus tard.` };
    }
    return { ok: false, error: "Impossible de joindre ce site. Vérifiez l'adresse." };
  }

  // Only the status matters: don't download the page.
  await response.body?.cancel().catch(() => {});

  if (response.ok || PROTECTED_STATUSES.has(response.status)) {
    return { ok: true, finalUrl: response.url || url };
  }
  if (response.status === 404 || response.status === 410) {
    return { ok: false, error: `Cette page n'existe pas (erreur ${response.status}). Vérifiez l'adresse.` };
  }
  return { ok: false, error: `Le site répond avec une erreur (${response.status}). Réessayez plus tard.` };
}

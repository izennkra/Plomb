import { safeFetch, type FetchOptions } from "@/modules/fetching/safe-fetch";

export type WebsiteCheck = { ok: true; finalUrl: string } | { ok: false; error: string };

export type CheckWebsite = (url: string) => Promise<WebsiteCheck>;

/** Statuses meaning "the site exists but refuses robots": the source is still accepted. */
const PROTECTED_STATUSES = new Set([401, 403, 429]);

/** Contacts a website to make sure it exists, following redirects. */
export async function checkWebsite(url: string, options: FetchOptions = {}): Promise<WebsiteCheck> {
  const response = await safeFetch(url, { ...options, readBody: false });
  if (!response.ok) return { ok: false, error: response.error };

  const { status } = response;
  if ((status >= 200 && status < 300) || PROTECTED_STATUSES.has(status)) {
    return { ok: true, finalUrl: response.url };
  }
  if (status === 404 || status === 410) {
    return { ok: false, error: `Cette page n'existe pas (erreur ${status}). Vérifiez l'adresse.` };
  }
  return { ok: false, error: `Le site répond avec une erreur (${status}). Réessayez plus tard.` };
}

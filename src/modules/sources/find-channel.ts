import { findYoutubeFeed } from "@/modules/aspiration-web/youtube";
import { safeFetch } from "@/modules/fetching/safe-fetch";

export type ChannelCheck = { ok: true; feedUrl: string; name: string | null } | { ok: false; error: string };
export type FindChannel = (url: string) => Promise<ChannelCheck>;

/** Opens a YouTube channel page to find its RSS feed (free, official). */
export const findYoutubeChannel: FindChannel = async (url) => {
  const page = await safeFetch(url);
  if (!page.ok) return { ok: false, error: page.error };
  if (page.status === 404) return { ok: false, error: "Cette chaîne YouTube n'existe pas. Vérifiez l'adresse." };
  const found = page.status === 200 ? findYoutubeFeed(page.body) : null;
  if (!found) return { ok: false, error: "Plomb ne trouve pas le flux de cette chaîne YouTube." };
  return { ok: true, ...found };
};

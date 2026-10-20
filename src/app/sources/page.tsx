import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import type { Source } from "@/db/schema";
import { listRecentPosts } from "@/modules/aspiration-web/list-posts";
import { isRefreshing } from "@/modules/aspiration-web/refresh-source";
import { listSources } from "@/modules/sources/list-sources";
import { AutoRefresh } from "../auto-refresh";
import { SourcesBoard, type SourceTile } from "./sources-board";

export const dynamic = "force-dynamic";

const time = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

export default async function SourcesPage() {
  const db = await getDb();
  const sources = await listSources(db, DEFAULT_USER_ID);
  const postsBySource = await listRecentPosts(
    db,
    sources.map((source) => source.id),
  );
  const refreshing = sources.some((source) => isRefreshing(source));
  const tiles: SourceTile[] = sources.map((source) => ({
    id: source.id,
    name: source.displayName,
    type: source.type,
    url: source.url,
    imageUrl: source.imageUrl,
    favorite: source.favorite,
    status: statusLine(source, postsBySource.get(source.id)?.total ?? 0),
    error: source.lastFetchStatus === "error" && !isRefreshing(source),
  }));

  return (
    <main className="sources">
      <AutoRefresh active={refreshing} />
      <h1 className="visually-hidden">Sources ({sources.length})</h1>
      <SourcesBoard tiles={tiles} refreshing={refreshing} />
    </main>
  );
}

function statusLine(source: Source, total: number): string {
  const social = source.type !== "web" && source.type !== "youtube";
  if (isRefreshing(source)) return social ? "Demande en cours chez Apify (1 à 2 minutes)…" : "Relevé en cours…";
  const rhythm = source.type === "instagram" ? "2 fois par jour (7h30, 15h30)" : "4 fois par jour (7h30, 11h30, 15h30, 19h30)";
  if (social && !source.lastFetchedAt) return `Relevé ${rhythm}, ou avec « Relever maintenant ».`;
  if (source.lastFetchStatus === "error") return source.lastFetchMessage ?? "Erreur au dernier relevé.";
  if (!source.lastFetchedAt) return "Pas encore relevé.";
  const method = social ? `via Apify, ${rhythm}` : source.fetchMethod === "rss" ? "flux RSS" : "lecture de la page";
  return `${total} article${total > 1 ? "s" : ""} · relevé à ${time.format(source.lastFetchedAt)} (${method}) · dernier relevé : ${source.lastFetchMessage}`;
}

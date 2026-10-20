import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import type { Source } from "@/db/schema";
import { listRecentPosts, type PostSummary } from "@/modules/aspiration-web/list-posts";
import { isRefreshing } from "@/modules/aspiration-web/refresh-source";
import { listSources } from "@/modules/sources/list-sources";
import { refreshAllAction, toggleFavoriteAction, unsubscribeAction } from "../actions";
import { AddSourceForm } from "./add-source-form";
import { AutoRefresh } from "../auto-refresh";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<Source["type"], string> = {
  web: "Site web",
  youtube: "YouTube",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
};

const time = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" });

export default async function SourcesPage() {
  const db = await getDb();
  const sources = await listSources(db, DEFAULT_USER_ID);
  const postsBySource = await listRecentPosts(
    db,
    sources.map((source) => source.id),
  );
  const refreshing = sources.some((source) => isRefreshing(source));

  return (
    <main>
      <AutoRefresh active={refreshing} />
      <h1>Sources</h1>
      <AddSourceForm />

      <h2>Mes sources ({sources.length})</h2>
      {sources.length > 0 && (
        <form action={refreshAllAction}>
          <button type="submit" disabled={refreshing}>
            {refreshing ? "Relevé en cours…" : "Relever maintenant"}
          </button>
        </form>
      )}


      {sources.length === 0 ? (
        <p>Aucune source pour l&apos;instant. Collez le lien d&apos;un site, d&apos;un compte Instagram, X ou LinkedIn.</p>
      ) : (
        <ul>
          {sources.map((source) => {
            const sourcePosts = postsBySource.get(source.id) ?? { total: 0, recent: [] };
            return (
              <li key={source.id}>
                <span>{TYPE_LABELS[source.type]}</span> —{" "}
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.displayName}
                </a>{" "}
                <form action={toggleFavoriteAction} style={{ display: "inline" }}>
                  <input type="hidden" name="sourceId" value={source.id} />
                  <input type="hidden" name="favorite" value={String(!source.favorite)} />
                  <button
                    type="submit"
                    aria-pressed={source.favorite}
                    aria-label={source.favorite ? `Retirer ${source.displayName} des favoris` : `Mettre ${source.displayName} en favori`}
                    title="Les sources favorites passent en priorité dans le journal"
                  >
                    {source.favorite ? "★ Favori" : "☆ Favori"}
                  </button>
                </form>{" "}
                <form action={unsubscribeAction} style={{ display: "inline" }}>
                  <input type="hidden" name="sourceId" value={source.id} />
                  <button type="submit" aria-label={`Retirer ${source.displayName}`}>
                    Retirer
                  </button>
                </form>
                <p>
                  <small>{statusLine(source, sourcePosts.total)}</small>
                </p>
                {sourcePosts.recent.length > 0 && (
                  <details>
                    <summary>Derniers articles</summary>
                    <ul>
                      {sourcePosts.recent.map((post) => (
                        <PostItem key={post.id} post={post} />
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function statusLine(source: Source, total: number): string {
  const social = source.type !== "web" && source.type !== "youtube";
  if (isRefreshing(source)) return social ? "Demande en cours chez Apify (1 à 2 minutes)…" : "Relevé en cours…";
  const rhythm = source.type === "instagram" ? "2 fois par jour (7h30, 15h30)" : "4 fois par jour (7h30, 11h30, 15h30, 19h30)";
  if (social && !source.lastFetchedAt) return `Relevé ${rhythm}, ou avec « Relever maintenant ».`;
  if (source.lastFetchStatus === "error") return `⚠ ${source.lastFetchMessage}`;
  if (!source.lastFetchedAt) return "Pas encore relevé.";
  const method = social ? `via Apify, ${rhythm}` : source.fetchMethod === "rss" ? "flux RSS" : "lecture de la page";
  return `${total} article${total > 1 ? "s" : ""} · relevé à ${time.format(source.lastFetchedAt)} (${method}) · dernier relevé : ${source.lastFetchMessage}`;
}

function PostItem({ post }: { post: PostSummary }) {
  const date = post.publishedAt ? `publié le ${day.format(post.publishedAt)}` : `découvert le ${day.format(post.discoveredAt)}`;
  return (
    <li>
      {post.imageUrl && (
        // External images from each media: plain <img>, sized small for this test page.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" width={96} height={64} style={{ objectFit: "cover", verticalAlign: "middle" }} />
      )}{" "}
      <a href={post.url} target="_blank" rel="noreferrer">
        {post.title}
      </a>{" "}
      <small>
        · {date}
        {post.images && ` · ${post.images.length} image${post.images.length > 1 ? "s" : ""}`}
        {post.beforeSubscription && " · avant l'abonnement"}
      </small>
    </li>
  );
}

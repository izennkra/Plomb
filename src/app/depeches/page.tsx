import Link from "next/link";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import type { Source } from "@/db/schema";
import { listFeed } from "@/modules/depeches/list-feed";
import { listSources } from "@/modules/sources/list-sources";
import { Filters } from "../components/filters";
import { PostCard } from "../components/post-card";
import { Stream } from "./stream";

export const dynamic = "force-dynamic";

const TYPES: Source["type"][] = ["web", "youtube", "instagram", "x", "linkedin"];

type SearchParams = Promise<{ type?: string; source?: string }>;

export default async function DepechesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const type = TYPES.find((value) => value === params.type);
  const sourceNumber = Number(params.source);
  const sourceId = Number.isInteger(sourceNumber) && sourceNumber > 0 ? sourceNumber : undefined;

  const db = await getDb();
  const now = new Date();
  const [items, sources] = await Promise.all([
    listFeed(db, DEFAULT_USER_ID, { now, type, sourceId }),
    listSources(db, DEFAULT_USER_ID),
  ]);
  const filtered = type !== undefined || sourceId !== undefined;

  return (
    <main className="depeches">
      <h1 className="visually-hidden">Dépêches</h1>
      {sources.length > 0 && <Filters sources={sources} type={type} sourceId={sourceId} />}
      {items.length === 0 ? (
        <p className="empty">
          {filtered ? (
            <>
              Aucune dépêche cette semaine pour ce filtre. <Link href="/depeches">Tout afficher</Link>
            </>
          ) : (
            <>
              Aucune dépêche cette semaine. <Link href="/sources">Ajoute des sources</Link> pour remplir la salle de dépêches.
            </>
          )}
        </p>
      ) : (
        <Stream discovered={items.map((item) => item.discoveredAt.getTime())}>
          {items.map((item) => (
            <PostCard key={item.id} item={item} now={now} />
          ))}
        </Stream>
      )}
    </main>
  );
}

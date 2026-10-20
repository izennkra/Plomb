import Link from "next/link";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import type { Source } from "@/db/schema";
import { listFeed } from "@/modules/depeches/list-feed";
import { listSources } from "@/modules/sources/list-sources";
import { Filters } from "./components/filters";
import { PostCard } from "./components/post-card";

export const dynamic = "force-dynamic";

const TYPES: Source["type"][] = ["web", "instagram", "x", "linkedin"];

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
    <main>
      <h1 className="page-title">Dépêches</h1>
      {sources.length > 0 && <Filters sources={sources} type={type} sourceId={sourceId} />}
      {items.length === 0 ? (
        <p>
          {filtered ? (
            <>
              Aucune dépêche cette semaine pour ce filtre. <Link href="/">Tout afficher</Link>
            </>
          ) : (
            <>
              Aucune dépêche cette semaine. <Link href="/sources">Ajoutez des sources</Link> pour remplir votre salle de dépêches.
            </>
          )}
        </p>
      ) : (
        <div className="feed">
          {items.map((item) => (
            <PostCard key={item.id} item={item} now={now} />
          ))}
        </div>
      )}
    </main>
  );
}

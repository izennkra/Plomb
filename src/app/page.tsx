import Link from "next/link";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import { listFeed } from "@/modules/depeches/list-feed";
import { PostCard } from "./components/post-card";

export const dynamic = "force-dynamic";

export default async function DepechesPage() {
  const now = new Date();
  const items = await listFeed(await getDb(), DEFAULT_USER_ID, { now });

  return (
    <main>
      <h1 className="page-title">Dépêches</h1>
      {items.length === 0 ? (
        <p>
          Aucune dépêche cette semaine. <Link href="/sources">Ajoutez des sources</Link> pour remplir votre salle de dépêches.
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

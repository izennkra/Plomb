import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import { listFeed } from "@/modules/depeches/list-feed";

export const dynamic = "force-dynamic";

export default async function DepechesPage() {
  const items = await listFeed(await getDb(), DEFAULT_USER_ID);

  return (
    <main>
      <h1>Dépêches</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.title} — {item.source.displayName}
          </li>
        ))}
      </ul>
    </main>
  );
}

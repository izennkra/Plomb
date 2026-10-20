import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sources, subscriptions, type Source } from "@/db/schema";

export type FollowedSource = Source & { favorite: boolean };

/** Sources followed by a user, most recently added first, with the user's favourite mark. */
export async function listSources(db: Db, userId: string): Promise<FollowedSource[]> {
  const rows = await db
    .select({ source: sources, favorite: subscriptions.favorite })
    .from(subscriptions)
    .innerJoin(sources, eq(subscriptions.sourceId, sources.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt), desc(subscriptions.sourceId));
  return rows.map((row) => ({ ...row.source, favorite: row.favorite }));
}

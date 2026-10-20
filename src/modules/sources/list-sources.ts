import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sources, subscriptions, type Source } from "@/db/schema";

/** Sources followed by a user, most recently added first. */
export async function listSources(db: Db, userId: string): Promise<Source[]> {
  const rows = await db
    .select({ source: sources })
    .from(subscriptions)
    .innerJoin(sources, eq(subscriptions.sourceId, sources.id))
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt), desc(subscriptions.sourceId));
  return rows.map((row) => row.source);
}

import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sources, subscriptions } from "@/db/schema";

/**
 * Removes a source from a user's list.
 * The source itself is deleted only once nobody follows it anymore.
 * Returns false when the user did not follow that source.
 */
export async function unsubscribe(db: Db, userId: string, sourceId: number): Promise<boolean> {
  const removed = await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.sourceId, sourceId)))
    .returning();
  if (removed.length === 0) return false;

  const stillFollowed = await db.query.subscriptions.findFirst({ where: eq(subscriptions.sourceId, sourceId) });
  if (!stillFollowed) await db.delete(sources).where(eq(sources.id, sourceId));
  return true;
}

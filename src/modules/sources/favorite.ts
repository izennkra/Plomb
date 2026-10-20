import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { subscriptions } from "@/db/schema";

/** Marks or unmarks a followed source as favourite. Returns false when the user does not follow it. */
export async function setFavorite(db: Db, userId: string, sourceId: number, favorite: boolean): Promise<boolean> {
  const updated = await db
    .update(subscriptions)
    .set({ favorite })
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.sourceId, sourceId)))
    .returning();
  return updated.length > 0;
}

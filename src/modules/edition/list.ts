import { and, desc, eq, gte } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editionItems, editions, type Edition, type EditionItem } from "@/db/schema";
import { parisDay } from "./paris-time";

/** Editions kept and listed: the one of the day and the previous ones of the week. */
export const EDITIONS_KEPT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A preparation running for longer than this has been interrupted (server restarted…). */
const STALE_BUILD_MS = 30 * 60_000;

export function isBuilding(edition: Pick<Edition, "status" | "createdAt">, now = Date.now()): boolean {
  return edition.status === "building" && now - edition.createdAt.getTime() < STALE_BUILD_MS;
}

/** The user's editions of the last 7 days, most recent first. */
export async function listEditions(db: Db, userId: string, { now = new Date() } = {}): Promise<Edition[]> {
  const oldest = parisDay(new Date(now.getTime() - EDITIONS_KEPT_DAYS * DAY_MS));
  return db
    .select()
    .from(editions)
    .where(and(eq(editions.userId, userId), gte(editions.day, oldest)))
    .orderBy(desc(editions.day));
}

export async function getEditionItems(db: Db, editionId: number): Promise<EditionItem[]> {
  return db.select().from(editionItems).where(eq(editionItems.editionId, editionId)).orderBy(editionItems.position);
}

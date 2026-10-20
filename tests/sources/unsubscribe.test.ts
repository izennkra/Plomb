import { describe, expect, it } from "vitest";
import { DEFAULT_USER_ID } from "@/db/client";
import { sources, subscriptions, users } from "@/db/schema";
import { addSource } from "@/modules/sources/add-source";
import type { CheckWebsite } from "@/modules/sources/check-website";
import { unsubscribe } from "@/modules/sources/unsubscribe";
import { createTestDb } from "../helpers/test-db";

const siteUp: CheckWebsite = async (url) => ({ ok: true, finalUrl: url });

async function follow(db: Awaited<ReturnType<typeof createTestDb>>, userId: string, url: string) {
  const result = await addSource(db, userId, url, { checkWebsite: siteUp });
  if (!result.ok) throw new Error(result.error);
  return result.source.id;
}

describe("unsubscribe", () => {
  it("removes the source from the user's list and deletes it when nobody follows it anymore", async () => {
    const db = await createTestDb();
    const id = await follow(db, DEFAULT_USER_ID, "instagram.com/mouthwash.studio");

    expect(await unsubscribe(db, DEFAULT_USER_ID, id)).toBe(true);

    expect(await db.select().from(subscriptions)).toHaveLength(0);
    expect(await db.select().from(sources)).toHaveLength(0);
  });

  it("keeps the source when another user still follows it", async () => {
    const db = await createTestDb();
    await db.insert(users).values({ id: "other" });
    const id = await follow(db, DEFAULT_USER_ID, "x.com/studiobakers");
    await follow(db, "other", "x.com/studiobakers");

    await unsubscribe(db, DEFAULT_USER_ID, id);

    expect(await db.select().from(sources)).toHaveLength(1);
    expect(await db.select().from(subscriptions)).toEqual([expect.objectContaining({ userId: "other" })]);
  });

  it("returns false when the user did not follow the source", async () => {
    const db = await createTestDb();
    await db.insert(users).values({ id: "other" });
    const id = await follow(db, "other", "x.com/studiobakers");

    expect(await unsubscribe(db, DEFAULT_USER_ID, id)).toBe(false);
    expect(await db.select().from(subscriptions)).toHaveLength(1);
  });
});

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEFAULT_USER_ID, prepareDb } from "@/db/client";
import { sources, subscriptions, users } from "@/db/schema";
import { createTestDb } from "../helpers/test-db";

const source = {
  type: "instagram" as const,
  displayName: "@mouthwash.studio",
  url: "https://www.instagram.com/mouthwash.studio",
  key: "instagram:mouthwash.studio",
};

describe("database", () => {
  it("creates the default user", async () => {
    const db = await createTestDb();
    expect(await db.select().from(users)).toEqual([expect.objectContaining({ id: DEFAULT_USER_ID })]);
  });

  it("can be prepared twice without error", async () => {
    const db = await createTestDb();
    await prepareDb(db);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("refuses two sources with the same key", async () => {
    const db = await createTestDb();
    await db.insert(sources).values(source);
    await expect(db.insert(sources).values(source)).rejects.toThrow();
  });

  it("refuses a subscription to a source that does not exist", async () => {
    const db = await createTestDb();
    await expect(db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId: 999 })).rejects.toThrow();
  });

  it("lets several users follow the same source", async () => {
    const db = await createTestDb();
    await db.insert(users).values({ id: "other" });
    const [{ id }] = await db.insert(sources).values(source).returning({ id: sources.id });
    await db.insert(subscriptions).values([
      { userId: DEFAULT_USER_ID, sourceId: id },
      { userId: "other", sourceId: id },
    ]);
    expect(await db.select().from(subscriptions).where(eq(subscriptions.sourceId, id))).toHaveLength(2);
  });
});

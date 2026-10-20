import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEFAULT_USER_ID, prepareDb } from "@/db/client";
import { editionItems, editions, posts, sources, subscriptions, users } from "@/db/schema";
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

  describe("posts", () => {
    const post = (sourceId: number) => ({
      sourceId,
      url: "https://the-brandidentity.com/project/madeleine",
      title: "Studio Hi Ho pairs kraft and butter yellow",
      method: "page" as const,
    });

    it("stores an article only once per source", async () => {
      const db = await createTestDb();
      const [{ id }] = await db.insert(sources).values(source).returning({ id: sources.id });
      await db.insert(posts).values(post(id));
      await expect(db.insert(posts).values(post(id))).rejects.toThrow();
    });

    it("lets two sources share the same article", async () => {
      const db = await createTestDb();
      const [a] = await db.insert(sources).values(source).returning({ id: sources.id });
      const [b] = await db
        .insert(sources)
        .values({ ...source, key: "web:the-brandidentity.com" })
        .returning({ id: sources.id });
      await db.insert(posts).values([post(a.id), post(b.id)]);
      expect(await db.select().from(posts)).toHaveLength(2);
    });

    it("is new news by default, with its discovery date", async () => {
      const db = await createTestDb();
      const [{ id }] = await db.insert(sources).values(source).returning({ id: sources.id });
      const [stored] = await db.insert(posts).values(post(id)).returning();
      expect(stored.beforeSubscription).toBe(false);
      expect(stored.discoveredAt).toBeInstanceOf(Date);
      expect(stored.publishedAt).toBeNull();
    });

    it("stores the gallery of an article as an ordered list", async () => {
      const db = await createTestDb();
      const [{ id }] = await db.insert(sources).values(source).returning({ id: sources.id });
      const images = ["https://example.com/1.jpg", "https://example.com/2.jpg"];
      const [stored] = await db.insert(posts).values({ ...post(id), images }).returning();
      expect(stored.images).toEqual(images);

      const [old] = await db.insert(posts).values({ ...post(id), url: "https://example.com/old" }).returning();
      expect(old.images).toBeNull();
    });

    it("deletes the articles of a deleted source", async () => {
      const db = await createTestDb();
      const [{ id }] = await db.insert(sources).values(source).returning({ id: sources.id });
      await db.insert(posts).values(post(id));
      await db.delete(sources).where(eq(sources.id, id));
      expect(await db.select().from(posts)).toHaveLength(0);
    });
  });

  describe("editions", () => {
    const edition = {
      userId: DEFAULT_USER_ID,
      day: "2026-10-21",
      periodStart: new Date("2026-10-20T06:00:00Z"),
      periodEnd: new Date("2026-10-21T06:00:00Z"),
    };

    it("stores an edition with its articles, in order", async () => {
      const db = await createTestDb();
      const [{ id }] = await db.insert(editions).values(edition).returning({ id: editions.id });
      await db.insert(editionItems).values([
        { editionId: id, position: 2, placement: "secondaire", title: "B", url: "https://b", images: [], sourceName: "s" },
        { editionId: id, position: 1, placement: "une", title: "A", url: "https://a", images: ["https://a/1.jpg"], sourceName: "s", theme: "Packaging" },
      ]);

      const stored = await db.query.editions.findFirst({ where: eq(editions.id, id) });
      expect(stored).toMatchObject({ status: "building", language: "fr" });
      const items = await db.select().from(editionItems).orderBy(editionItems.position);
      expect(items.map((item) => item.title)).toEqual(["A", "B"]);
      expect(items[0].images).toEqual(["https://a/1.jpg"]);
    });

    it("allows one edition per user and per day", async () => {
      const db = await createTestDb();
      await db.insert(editions).values(edition);
      await expect(db.insert(editions).values(edition)).rejects.toThrow();
    });

    it("keeps an edition's article readable when the article itself is deleted", async () => {
      const db = await createTestDb();
      const [{ id: sourceId }] = await db.insert(sources).values(source).returning({ id: sources.id });
      const [{ id: postId }] = await db
        .insert(posts)
        .values({ sourceId, url: "https://a", title: "A", method: "page" })
        .returning({ id: posts.id });
      const [{ id }] = await db.insert(editions).values(edition).returning({ id: editions.id });
      await db.insert(editionItems).values({ editionId: id, postId, position: 1, placement: "une", title: "A", url: "https://a", images: [], sourceName: "s" });

      await db.delete(posts).where(eq(posts.id, postId));

      const [item] = await db.select().from(editionItems);
      expect(item).toMatchObject({ title: "A", postId: null });
    });
  });

  it("subscriptions are not favourites by default", async () => {
    const db = await createTestDb();
    const [{ id }] = await db.insert(sources).values(source).returning({ id: sources.id });
    const [subscription] = await db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId: id }).returning();
    expect(subscription.favorite).toBe(false);
  });
});

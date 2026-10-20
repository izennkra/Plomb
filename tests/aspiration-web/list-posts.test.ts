import { describe, expect, it } from "vitest";
import { posts, sources } from "@/db/schema";
import { listRecentPosts } from "@/modules/aspiration-web/list-posts";
import { createTestDb } from "../helpers/test-db";

describe("listRecentPosts", () => {
  it("lists the most recent articles per source, with the total", async () => {
    const db = await createTestDb();
    const [{ id }] = await db
      .insert(sources)
      .values({ type: "web", displayName: "example.com", url: "https://example.com", key: "web:example.com" })
      .returning({ id: sources.id });
    await db.insert(posts).values([
      { sourceId: id, url: "https://example.com/old", title: "Old", method: "rss", publishedAt: new Date("2026-01-01") },
      { sourceId: id, url: "https://example.com/new", title: "New", method: "rss", publishedAt: new Date("2026-10-19") },
      { sourceId: id, url: "https://example.com/mid", title: "Mid", method: "rss", publishedAt: new Date("2026-05-01") },
    ]);

    const result = await listRecentPosts(db, [id], 2);

    expect(result.get(id)?.total).toBe(3);
    expect(result.get(id)?.recent.map((post) => post.title)).toEqual(["New", "Mid"]);
  });

  it("returns an empty entry for a source without articles", async () => {
    const db = await createTestDb();
    expect(await listRecentPosts(db, [])).toEqual(new Map());
  });
});

import { describe, expect, it } from "vitest";
import { posts, seenLinks, sources } from "@/db/schema";
import { purgeOldPosts } from "@/modules/depeches/purge";
import { DAY_MS } from "@/modules/depeches/settings";
import { createTestDb } from "../helpers/test-db";

const now = new Date("2026-10-20T10:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

describe("purgeOldPosts", () => {
  it("deletes publications older than 7 days and keeps their address as already seen", async () => {
    const db = await createTestDb();
    const [{ id }] = await db
      .insert(sources)
      .values({ type: "web", displayName: "s", url: "https://s.example", key: "web:s" })
      .returning({ id: sources.id });
    await db.insert(posts).values([
      { sourceId: id, url: "https://s.example/old", title: "old", method: "rss", publishedAt: daysAgo(8) },
      { sourceId: id, url: "https://s.example/recent", title: "recent", method: "rss", publishedAt: daysAgo(6) },
      { sourceId: id, url: "https://s.example/undated", title: "undated", method: "page", discoveredAt: daysAgo(9) },
    ]);

    expect(await purgeOldPosts(db, now)).toBe(2);

    expect((await db.select().from(posts)).map((post) => post.title)).toEqual(["recent"]);
    expect((await db.select().from(seenLinks)).map((link) => link.url).sort()).toEqual([
      "https://s.example/old",
      "https://s.example/undated",
    ]);
  });
});

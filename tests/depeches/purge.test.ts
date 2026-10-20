import { describe, expect, it } from "vitest";
import { DEFAULT_USER_ID } from "@/db/client";
import { editions, posts, seenLinks, sources } from "@/db/schema";
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

  it("deletes editions of more than a week ago", async () => {
    const db = await createTestDb();
    const edition = (day: string) => ({ userId: DEFAULT_USER_ID, day, periodStart: now, periodEnd: now, status: "ready" as const });
    await db.insert(editions).values([edition("2026-10-12"), edition("2026-10-14"), edition("2026-10-20")]);

    await purgeOldPosts(db, now);

    expect((await db.select().from(editions)).map((e) => e.day).sort()).toEqual(["2026-10-14", "2026-10-20"]);
  });
});

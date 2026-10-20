import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_USER_ID, type Db } from "@/db/client";
import { editions, posts, sources, subscriptions } from "@/db/schema";
import { parisDay, parisTime } from "@/modules/edition/paris-time";
import { selectEditionPosts } from "@/modules/edition/select";
import { createTestDb } from "../helpers/test-db";

describe("Paris time", () => {
  it("8:00 in Paris is 06:00 UTC in summer time and 07:00 UTC in winter time", () => {
    expect(parisTime("2026-10-21", 8).toISOString()).toBe("2026-10-21T06:00:00.000Z");
    expect(parisTime("2026-11-02", 8).toISOString()).toBe("2026-11-02T07:00:00.000Z");
  });

  it("gives the Paris day (23:30 UTC is already tomorrow in Paris)", () => {
    expect(parisDay(new Date("2026-10-20T23:30:00Z"))).toBe("2026-10-21");
  });
});

describe("selectEditionPosts", () => {
  let db: Db;
  let sourceId: number;
  const now = new Date("2026-10-21T06:30:00Z"); // 8:30 in Paris
  const at = (iso: string) => new Date(iso);

  beforeEach(async () => {
    db = await createTestDb();
    [{ id: sourceId }] = await db
      .insert(sources)
      .values({ type: "web", displayName: "itsnicethat.com", url: "https://www.itsnicethat.com", key: "web:itsnicethat.com" })
      .returning({ id: sources.id });
    await db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId });
  });

  const add = (title: string, discoveredAt: Date, extra: Partial<typeof posts.$inferInsert> = {}) =>
    db.insert(posts).values({ sourceId, url: `https://example.com/${title}`, title, method: "rss", discoveredAt, ...extra });

  const titles = async () => (await selectEditionPosts(db, DEFAULT_USER_ID, { now })).posts.map((post) => post.title);

  it("first edition: the 24 hours before 8:00 (Paris)", async () => {
    await add("too-old", at("2026-10-20T05:00:00Z"));
    await add("yesterday-evening", at("2026-10-20T18:00:00Z"));
    await add("before-8", at("2026-10-21T05:59:00Z"));
    await add("after-8", at("2026-10-21T06:10:00Z")); // for tomorrow's edition

    const selection = await selectEditionPosts(db, DEFAULT_USER_ID, { now });
    expect(selection.day).toBe("2026-10-21");
    expect(selection.periodEnd.toISOString()).toBe("2026-10-21T06:00:00.000Z");
    expect(selection.posts.map((post) => post.title)).toEqual(["before-8", "yesterday-evening"]);
  });

  it("next editions: since the end of the previous edition", async () => {
    await db.insert(editions).values({
      userId: DEFAULT_USER_ID,
      day: "2026-10-20",
      periodStart: at("2026-10-19T06:00:00Z"),
      periodEnd: at("2026-10-20T12:00:00Z"), // prepared by hand at 14:00 yesterday
      status: "ready",
    });
    await add("already-in-yesterday", at("2026-10-20T11:00:00Z"));
    await add("new", at("2026-10-20T13:00:00Z"));

    expect(await titles()).toEqual(["new"]);
  });

  it("never takes an old article that reappears on a site, even if newly found", async () => {
    await add("old-article-in-most-read", at("2026-10-20T18:00:00Z"), { publishedAt: at("2026-06-01T10:00:00Z") });
    await add("published-yesterday", at("2026-10-20T18:00:00Z"), { publishedAt: at("2026-10-20T09:00:00Z") });
    // Published just before the period and found a bit late: still taken (12 h margin).
    await add("found-late", at("2026-10-20T18:00:00Z"), { publishedAt: at("2026-10-19T22:00:00Z") });
    // Date without time (sites that give only the day): the whole day counts.
    await add("dated-yesterday-day-only", at("2026-10-20T18:00:00Z"), { publishedAt: at("2026-10-20T00:00:00Z") });
    // No date at all, but appeared after the subscription: new.
    await add("undated-new", at("2026-10-20T18:00:00Z"));

    expect((await titles()).sort()).toEqual(["dated-yesterday-day-only", "found-late", "published-yesterday", "undated-new"]);
  });

  it("never takes articles already there before the subscription", async () => {
    await add("backfill", at("2026-10-20T18:00:00Z"), { beforeSubscription: true });
    expect(await titles()).toEqual([]);
  });

  it("favourite sources come first, and carry their gallery", async () => {
    const [{ id: favoriteId }] = await db
      .insert(sources)
      .values({ type: "web", displayName: "fav.com", url: "https://fav.com", key: "web:fav.com" })
      .returning({ id: sources.id });
    await db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId: favoriteId, favorite: true });
    await add("ordinary", at("2026-10-21T05:00:00Z"));
    await db.insert(posts).values({
      sourceId: favoriteId,
      url: "https://fav.com/a",
      title: "favourite",
      method: "page",
      discoveredAt: at("2026-10-20T20:00:00Z"),
      imageUrl: "https://fav.com/only.jpg",
    });

    const { posts: selected } = await selectEditionPosts(db, DEFAULT_USER_ID, { now });
    expect(selected.map((post) => post.title)).toEqual(["favourite", "ordinary"]);
    expect(selected[0]).toMatchObject({ favorite: true, sourceName: "fav.com", images: ["https://fav.com/only.jpg"] });
  });

  it("counts an article followed through two sources once", async () => {
    const [{ id: otherId }] = await db
      .insert(sources)
      .values({ type: "web", displayName: "other", url: "https://o.com", key: "web:o.com" })
      .returning({ id: sources.id });
    await db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId: otherId });
    await add("shared", at("2026-10-21T05:00:00Z"));
    await db.insert(posts).values({ sourceId: otherId, url: "https://example.com/shared", title: "shared", method: "rss", discoveredAt: at("2026-10-21T05:00:00Z") });

    expect(await titles()).toEqual(["shared"]);
  });

  it("test mode: until now, including articles from before the subscription — when recently published", async () => {
    await add("backfill-published-yesterday", at("2026-10-21T06:20:00Z"), { beforeSubscription: true, publishedAt: at("2026-10-20T15:00:00Z") });
    // Found today, but published on 14 July / 14 September: not news (Izenn's example).
    await add("off-live-14-july", at("2026-10-21T06:20:00Z"), { beforeSubscription: true, publishedAt: at("2026-07-14T15:01:33Z") });
    await add("findings-14-september", at("2026-10-21T06:20:00Z"), { beforeSubscription: true, publishedAt: at("2026-09-14T16:01:21Z") });
    // No date and already there before the subscription: its age is unknown.
    await add("undated-backfill", at("2026-10-21T06:20:00Z"), { beforeSubscription: true });

    const selection = await selectEditionPosts(db, DEFAULT_USER_ID, { now, testMode: true });

    expect(selection.periodEnd).toEqual(now);
    expect(selection.posts.map((post) => post.title)).toEqual(["backfill-published-yesterday"]);
  });

  it("test mode keeps at most 10 articles (the Mac stays usable)", async () => {
    for (let i = 0; i < 15; i++) await add(`post-${i}`, at("2026-10-21T05:00:00Z"), { publishedAt: at("2026-10-21T04:00:00Z") });
    const selection = await selectEditionPosts(db, DEFAULT_USER_ID, { now, testMode: true });
    expect(selection.posts).toHaveLength(10);
  });

  it("test mode mixes the sources", async () => {
    const [{ id: otherId }] = await db
      .insert(sources)
      .values({ type: "web", displayName: "other", url: "https://o.com", key: "web:o.com" })
      .returning({ id: sources.id });
    await db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId: otherId });
    for (let i = 0; i < 12; i++) await add(`main-${i}`, at("2026-10-21T05:00:00Z"));
    await db.insert(posts).values({ sourceId: otherId, url: "https://o.com/x", title: "other-1", method: "rss", discoveredAt: at("2026-10-20T10:00:00Z"), publishedAt: at("2026-10-20T09:00:00Z") });

    const selection = await selectEditionPosts(db, DEFAULT_USER_ID, { now, testMode: true });
    expect(selection.posts.map((post) => post.title)).toContain("other-1");
  });
});

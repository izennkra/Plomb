import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_USER_ID, type Db } from "@/db/client";
import { posts, sources, subscriptions, users } from "@/db/schema";
import { listFeed } from "@/modules/depeches/list-feed";
import { BACKFILL_MAX_AGE_DAYS, DAY_MS } from "@/modules/depeches/settings";
import { createTestDb } from "../helpers/test-db";

const now = new Date("2026-10-20T10:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

let db: Db;
let web: number;
let other: number;
let insta: number;

beforeEach(async () => {
  db = await createTestDb();
  [{ id: web }, { id: other }, { id: insta }] = await db
    .insert(sources)
    .values([
      { type: "web", displayName: "itsnicethat.com", url: "https://www.itsnicethat.com", key: "web:itsnicethat.com" },
      { type: "web", displayName: "the-brandidentity.com", url: "https://the-brandidentity.com", key: "web:tbi" },
      { type: "instagram", displayName: "@studio", url: "https://www.instagram.com/studio", key: "instagram:studio" },
    ])
    .returning({ id: sources.id });
  await db.insert(subscriptions).values([web, other, insta].map((sourceId) => ({ userId: DEFAULT_USER_ID, sourceId })));
});

type PostInput = Partial<typeof posts.$inferInsert> & { title: string };
const add = (sourceId: number, post: PostInput) =>
  db.insert(posts).values({ url: `https://example.com/${post.title}`, method: "rss", discoveredAt: now, ...post, sourceId });

const titles = async (options = {}) => (await listFeed(db, DEFAULT_USER_ID, { now, ...options })).map((item) => item.title);

describe("listFeed", () => {
  it("mixes all sources, most recent first (publication date, else discovery date)", async () => {
    await add(web, { title: "two-days", publishedAt: daysAgo(2) });
    await add(other, { title: "one-hour", publishedAt: new Date(now.getTime() - 3_600_000) });
    await add(web, { title: "discovered-yesterday", discoveredAt: daysAgo(1) });

    expect(await titles()).toEqual(["one-hour", "discovered-yesterday", "two-days"]);
  });

  it("only covers the last 7 days", async () => {
    await add(web, { title: "six-days", publishedAt: daysAgo(6) });
    await add(web, { title: "eight-days", publishedAt: daysAgo(8) });

    expect(await titles()).toEqual(["six-days"]);
  });

  it("shows an article followed through two sources only once", async () => {
    const url = "https://the-brandidentity.com/project/madeleine";
    await add(web, { title: "madeleine", url, publishedAt: daysAgo(1) });
    await add(other, { title: "madeleine", url, publishedAt: daysAgo(1) });

    expect(await titles()).toEqual(["madeleine"]);
  });

  it("shows articles from before the subscription only when recent and dated", async () => {
    await add(web, { title: "old-backfill", beforeSubscription: true, publishedAt: daysAgo(BACKFILL_MAX_AGE_DAYS + 1) });
    await add(web, { title: "recent-backfill", beforeSubscription: true, publishedAt: daysAgo(BACKFILL_MAX_AGE_DAYS - 1) });
    await add(web, { title: "undated-backfill", beforeSubscription: true, publishedAt: null });

    expect(await titles()).toEqual(["recent-backfill"]);
  });

  it("only shows the user's sources", async () => {
    await db.insert(users).values({ id: "other-user" });
    const [{ id: notFollowed }] = await db
      .insert(sources)
      .values({ type: "web", displayName: "x.com", url: "https://x.example", key: "web:x.example" })
      .returning({ id: sources.id });
    await db.insert(subscriptions).values({ userId: "other-user", sourceId: notFollowed });
    await add(notFollowed, { title: "not-mine", publishedAt: daysAgo(1) });

    expect(await titles()).toEqual([]);
  });

  it("filters by type and by source", async () => {
    await add(web, { title: "web-a", publishedAt: daysAgo(1) });
    await add(other, { title: "web-b", publishedAt: daysAgo(2) });
    await add(insta, { title: "insta", publishedAt: daysAgo(3) });

    expect(await titles({ type: "instagram" })).toEqual(["insta"]);
    expect(await titles({ type: "web" })).toEqual(["web-a", "web-b"]);
    expect(await titles({ sourceId: other })).toEqual(["web-b"]);
  });

  it("gives each card its gallery, date and source", async () => {
    await add(web, { title: "card", publishedAt: daysAgo(1), images: ["https://i/1.jpg", "https://i/2.jpg"], excerpt: "Summary" });
    await add(web, { title: "old-card", publishedAt: daysAgo(2), imageUrl: "https://i/only.jpg" });

    const [card, oldCard] = await listFeed(db, DEFAULT_USER_ID, { now });
    expect(card).toMatchObject({
      title: "card",
      excerpt: "Summary",
      images: ["https://i/1.jpg", "https://i/2.jpg"],
      date: daysAgo(1),
      dateIsPublication: true,
      source: { id: web, displayName: "itsnicethat.com", type: "web" },
    });
    expect(oldCard.images).toEqual(["https://i/only.jpg"]);
  });
});

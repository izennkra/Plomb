import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_USER_ID, type Db } from "@/db/client";
import { editionItems, editions, posts, sources, subscriptions } from "@/db/schema";
import { buildEdition } from "@/modules/edition/build";
import { createFakeRedacteur } from "../helpers/fake-redacteur";
import { createTestDb } from "../helpers/test-db";

const now = new Date("2026-10-21T06:30:00Z"); // 8:30 in Paris
const yesterdayEvening = new Date("2026-10-20T18:00:00Z");

let db: Db;
let ordinary: number;
let favorite: number;

beforeEach(async () => {
  db = await createTestDb();
  [{ id: ordinary }, { id: favorite }] = await db
    .insert(sources)
    .values([
      { type: "web", displayName: "itsnicethat.com", url: "https://a.com", key: "web:a" },
      { type: "web", displayName: "fav.studio", url: "https://f.com", key: "web:f" },
    ])
    .returning({ id: sources.id });
  await db.insert(subscriptions).values([
    { userId: DEFAULT_USER_ID, sourceId: ordinary },
    { userId: DEFAULT_USER_ID, sourceId: favorite, favorite: true },
  ]);
});

const add = (sourceId: number, title: string, extra: Partial<typeof posts.$inferInsert> = {}) =>
  db.insert(posts).values({
    sourceId,
    url: `https://example.com/${title}`,
    title,
    excerpt: `Excerpt ${title}`,
    content: `Text of ${title}`,
    method: "rss",
    discoveredAt: yesterdayEvening,
    images: [`https://img/${title}.jpg`],
    ...extra,
  });

const itemsOf = async (editionId: number) =>
  db.select().from(editionItems).where(eq(editionItems.editionId, editionId)).orderBy(editionItems.position);

describe("buildEdition", () => {
  it("puts the most important article in the Une, then 2 secondary ones, then the rest by importance", async () => {
    for (const title of ["a", "b", "c", "d", "e"]) await add(ordinary, title);
    const { redacteur, leads } = createFakeRedacteur({ importance: { a: 1, b: 5, c: 3, d: 4, e: 2 } });

    const edition = await buildEdition(db, DEFAULT_USER_ID, { redacteur, now });

    expect(edition).toMatchObject({ day: "2026-10-21", status: "ready", model: "fake", message: "5 articles" });
    const items = await itemsOf(edition.id);
    expect(items.map((item) => [item.placement, item.title])).toEqual([
      ["une", "FR b"],
      ["secondaire", "FR d"],
      ["secondaire", "FR c"],
      ["suite", "FR e"],
      ["suite", "FR a"],
    ]);
    expect(items[0]).toMatchObject({
      summary: "Résumé de b",
      leadText: "Une de b",
      theme: "Identité",
      importance: 10,
      subject: "b",
      criteria: { notoriety: 5, scale: 5, authors: 5, reach: 5, quality: 5 },
      images: ["https://img/b.jpg"],
    });
    expect(leads.sort()).toEqual(["b", "c", "d"]);
  });

  it("gives favourite sources no ranking advantage, but marks them", async () => {
    await add(ordinary, "coca-cola-rebrand");
    await add(favorite, "local-cafe");
    const { redacteur } = createFakeRedacteur({ importance: { "coca-cola-rebrand": 5, "local-cafe": 2 } });

    const edition = await buildEdition(db, DEFAULT_USER_ID, { redacteur, now });

    const [une, last] = await itemsOf(edition.id);
    expect(une).toMatchObject({ title: "FR coca-cola-rebrand", favorite: false });
    expect(last).toMatchObject({ title: "FR local-cafe", favorite: true, sourceName: "fav.studio" });
  });

  it("still comes out when the AI fails on an article (media's own title and summary)", async () => {
    await add(ordinary, "fine");
    await add(ordinary, "broken");
    const { redacteur } = createFakeRedacteur({ failsOn: ["broken"], importance: { fine: 4 } });

    const edition = await buildEdition(db, DEFAULT_USER_ID, { redacteur, now });

    expect(edition.status).toBe("ready");
    const broken = (await itemsOf(edition.id)).find((item) => item.fallback);
    expect(broken).toMatchObject({ title: "broken", summary: "Excerpt broken", theme: null, leadText: null });
  });

  it("says so when there is no news", async () => {
    const { redacteur } = createFakeRedacteur();
    const edition = await buildEdition(db, DEFAULT_USER_ID, { redacteur, now });
    expect(edition).toMatchObject({ status: "ready", message: expect.stringMatching(/Pas de nouvelles/) });
    expect(await itemsOf(edition.id)).toEqual([]);
  });

  it("preparing again the same day replaces the edition", async () => {
    await add(ordinary, "first");
    const { redacteur } = createFakeRedacteur();
    const first = await buildEdition(db, DEFAULT_USER_ID, { redacteur, now });
    await add(ordinary, "second");

    const again = await buildEdition(db, DEFAULT_USER_ID, { redacteur, now });

    expect(again.id).toBe(first.id);
    expect(await db.select().from(editions)).toHaveLength(1);
    expect((await itemsOf(again.id)).map((item) => item.title).sort()).toEqual(["FR first", "FR second"]);
  });
});

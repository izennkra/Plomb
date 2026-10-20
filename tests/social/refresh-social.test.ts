import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_USER_ID, type Db } from "@/db/client";
import { posts, socialRuns, sources, subscriptions } from "@/db/schema";
import type { ApifyClient, RunStatus } from "@/modules/social/apify";
import { createDbMediaStore } from "@/modules/social/media-store";
import { collectSocialRuns, launchSocialRuns, socialWindowStart } from "@/modules/social/refresh-social";
import { createTestDb } from "../helpers/test-db";

const paris = (hhmm: string, day = "2026-10-21") => new Date(`${day}T${hhmm}:00+02:00`);
const instagramAnswer = JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "social", "instagram.json"), "utf8"));

/** A fake Apify: remembers the requests, answers what the test decides. */
function fakeApify({ usage = 0 } = {}) {
  const started: { actor: string; input: Record<string, unknown> }[] = [];
  let status: RunStatus = "RUNNING";
  const client: ApifyClient = {
    async startRun(actor, input) {
      started.push({ actor, input: input as Record<string, unknown> });
      return { runId: `run${started.length}`, datasetId: `ds${started.length}` };
    },
    async getRun() {
      return { status, datasetId: "ds" };
    },
    async getItems() {
      return instagramAnswer;
    },
    async monthlyUsageUsd() {
      return usage;
    },
  };
  return { client, started, finish: (s: RunStatus = "SUCCEEDED") => (status = s) };
}

let db: Db;
let mediaDir: string;
let sourceId: number;

beforeEach(async () => {
  db = await createTestDb();
  mediaDir = mkdtempSync(join(tmpdir(), "plomb-media-"));
  [{ id: sourceId }] = await db
    .insert(sources)
    .values({ type: "instagram", displayName: "@mouthwash.studio", url: "https://www.instagram.com/mouthwash.studio", key: "instagram:mouthwash.studio" })
    .returning({ id: sources.id });
  await db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId });
});
afterEach(() => rmSync(mediaDir, { recursive: true, force: true }));

const fakeImage = async () => ({ bytes: new Uint8Array([1]), contentType: "image/jpeg" });

describe("social windows", () => {
  it("7:30, 11:30, 15:30 and 19:30 (Paris), the early morning belongs to yesterday's 19:30", () => {
    expect(socialWindowStart(paris("07:20"))).toEqual(paris("19:30", "2026-10-20"));
    expect(socialWindowStart(paris("07:31"))).toEqual(paris("07:30"));
    expect(socialWindowStart(paris("12:00"))).toEqual(paris("11:30"));
    expect(socialWindowStart(paris("16:00"))).toEqual(paris("15:30"));
    expect(socialWindowStart(paris("23:00"))).toEqual(paris("19:30"));
    expect(socialWindowStart(paris("12:00"), [7.5, 15.5])).toEqual(paris("07:30"));
  });
});

describe("social relève", () => {
  it("asks for several Instagram accounts in a single request, and gives each its posts", async () => {
    const [{ id: otherId }] = await db
      .insert(sources)
      .values({ type: "instagram", displayName: "@another.studio", url: "https://www.instagram.com/another.studio", key: "instagram:another.studio" })
      .returning({ id: sources.id });
    await db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId: otherId });
    const apify = fakeApify();

    expect(await launchSocialRuns(db, { apify: apify.client, now: paris("07:31") })).toEqual({ launched: 2 });
    expect(apify.started).toHaveLength(1);
    expect(apify.started[0].input).toMatchObject({ username: ["mouthwash.studio", "another.studio"] });

    apify.finish();
    await collectSocialRuns(db, { apify: apify.client, mediaStore: createDbMediaStore(db), now: paris("07:46"), fetchImage: fakeImage });
    const bySource = await db.select().from(posts);
    expect(bySource.filter((post) => post.sourceId === sourceId)).toHaveLength(3);
    expect(bySource.filter((post) => post.sourceId === otherId)).toHaveLength(0);
    expect((await db.select().from(socialRuns)).every((run) => run.status === "done")).toBe(true);
  });

  it("launches once per window, then reads the results at the next call (posts + copied images)", async () => {
    const apify = fakeApify();

    expect(await launchSocialRuns(db, { apify: apify.client, now: paris("07:31") })).toEqual({ launched: 1 });
    expect(apify.started[0]).toMatchObject({ actor: "apify/instagram-post-scraper", input: { username: ["mouthwash.studio"], resultsLimit: 3 } });
    expect(await launchSocialRuns(db, { apify: apify.client, now: paris("07:46") })).toEqual({ launched: 0 });

    const store = createDbMediaStore(db);
    expect(await collectSocialRuns(db, { apify: apify.client, mediaStore: store, now: paris("07:46"), fetchImage: fakeImage })).toEqual({
      collected: 0,
      added: 0,
    });

    apify.finish();
    expect(await collectSocialRuns(db, { apify: apify.client, mediaStore: store, now: paris("08:01"), fetchImage: fakeImage })).toEqual({
      collected: 1,
      added: 3,
    });
    const stored = await db.select().from(posts);
    expect(stored).toHaveLength(3);
    expect(stored[0]).toMatchObject({ method: "social", beforeSubscription: true });
    expect(stored[0].images?.every((image) => image.startsWith("/media/"))).toBe(true);
    expect((await db.query.sources.findFirst())?.lastFetchMessage).toBe("3 nouveaux articles");
  });

  it("Instagram is checked twice a day only (7:30 and 15:30)", async () => {
    const apify = fakeApify();
    await launchSocialRuns(db, { apify: apify.client, now: paris("07:31") });
    apify.finish();
    await collectSocialRuns(db, { apify: apify.client, mediaStore: createDbMediaStore(db), now: paris("07:46"), fetchImage: fakeImage });

    expect((await launchSocialRuns(db, { apify: apify.client, now: paris("11:31") })).launched).toBe(0);
    expect((await launchSocialRuns(db, { apify: apify.client, now: paris("15:31") })).launched).toBe(1);
  });

  it("the next window asks only for posts newer than the last request that worked", async () => {
    const apify = fakeApify();
    await launchSocialRuns(db, { apify: apify.client, now: paris("07:31") });
    apify.finish();
    await collectSocialRuns(db, { apify: apify.client, mediaStore: createDbMediaStore(db), now: paris("07:46"), fetchImage: fakeImage });

    await launchSocialRuns(db, { apify: apify.client, now: paris("15:31") });

    expect(apify.started[1].input).toMatchObject({ onlyPostsNewerThan: paris("07:31").toISOString(), resultsLimit: 10 });
  });

  it("stops before using up the free credit, and says so", async () => {
    const apify = fakeApify({ usage: 4.1 });

    expect((await launchSocialRuns(db, { apify: apify.client, now: paris("07:31") })).skipped).toMatch(/presque épuisé/);
    expect(apify.started).toEqual([]);
    expect((await db.query.sources.findFirst())?.lastFetchStatus).toBe("error");
  });

  it("a failed request is marked, and retried at the next window", async () => {
    const apify = fakeApify();
    await launchSocialRuns(db, { apify: apify.client, now: paris("07:31") });
    apify.finish("FAILED");

    await collectSocialRuns(db, { apify: apify.client, mediaStore: createDbMediaStore(db), now: paris("07:46") });

    expect((await db.select().from(socialRuns))[0].status).toBe("failed");
    expect((await db.query.sources.findFirst())?.lastFetchStatus).toBe("error");
    expect((await launchSocialRuns(db, { apify: apify.client, now: paris("15:31") })).launched).toBe(1);
  });
});

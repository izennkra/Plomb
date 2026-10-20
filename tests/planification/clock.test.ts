import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_USER_ID, type Db } from "@/db/client";
import { editions, posts, sources, subscriptions, users } from "@/db/schema";
import { listEditions } from "@/modules/edition/list";
import { runClock, type ClockDeps } from "@/modules/planification/clock";
import type { EmailMessage } from "@/modules/planification/email-sender";
import type { FetchResult } from "@/modules/fetching/safe-fetch";
import { createFakeRedacteur } from "../helpers/fake-redacteur";
import { createTestDb } from "../helpers/test-db";

/** Paris time on Wednesday 21 October 2026 (summer time: UTC+2). */
const paris = (hhmm: string, day = "2026-10-21") => new Date(`${day}T${hhmm}:00+02:00`);

let db: Db;
let sent: EmailMessage[];

const deps = (at: Date, extra: Partial<ClockDeps> = {}): ClockDeps => ({
  redacteur: () => createFakeRedacteur().redacteur,
  sendEmail: async (message) => {
    sent.push(message);
  },
  emailTo: "izenn@example.com",
  journalUrl: "https://plomb.example/journal",
  // No real site in these tests: every page answers 404 at once.
  fetchPage: () => async (url: string): Promise<FetchResult> => ({ ok: true, url, status: 404, contentType: "", body: "" }),
  now: () => at,
  ...extra,
});

beforeEach(async () => {
  db = await createTestDb();
  sent = [];
  const [{ id }] = await db
    .insert(sources)
    .values({ type: "web", displayName: "itsnicethat.com", url: "https://www.itsnicethat.com", key: "web:int", lastFetchedAt: paris("07:59") })
    .returning({ id: sources.id });
  await db.insert(subscriptions).values({ userId: DEFAULT_USER_ID, sourceId: id });
  await db.insert(posts).values({
    sourceId: id,
    url: "https://www.itsnicethat.com/articles/fulham-rebrand-by-music",
    title: "Fulham rebrand",
    method: "rss",
    discoveredAt: paris("21:00", "2026-10-20"),
    publishedAt: paris("20:00", "2026-10-20"),
  });
});

const editionOfTheDay = () => db.query.editions.findFirst({ where: eq(editions.day, "2026-10-21") });

describe("the clock", () => {
  it("does nothing for the journal before 8:00", async () => {
    const report = await runClock(db, deps(paris("07:45")));
    expect(report).toMatchObject({ edition: "none", emailsSent: 0 });
    expect(await editionOfTheDay()).toBeUndefined();
  });

  it("prepares the edition at 8:00, shown from 9:00 only, no e-mail yet", async () => {
    const report = await runClock(db, deps(paris("08:02")));

    expect(report.edition).toBe("prepared");
    const edition = await editionOfTheDay();
    expect(edition).toMatchObject({ status: "ready", publishAt: paris("09:00") });
    expect(sent).toEqual([]);
    expect(await listEditions(db, DEFAULT_USER_ID, { now: paris("08:30") })).toEqual([]);
    expect(await listEditions(db, DEFAULT_USER_ID, { now: paris("09:00") })).toHaveLength(1);
  });

  it("sends the e-mail from 9:00, only once", async () => {
    await runClock(db, deps(paris("08:02")));
    await runClock(db, deps(paris("09:01")));
    await runClock(db, deps(paris("09:16")));

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "izenn@example.com", subject: expect.stringMatching(/mercredi 21 octobre est prêt/) });
    expect(sent[0].text).toContain("https://plomb.example/journal?edition=");
    expect((await editionOfTheDay())?.emailSentAt).toEqual(paris("09:01"));
  });

  it("catches up when the clock missed 8:00 and 9:00 (first call at 10:00)", async () => {
    const report = await runClock(db, deps(paris("10:00")));
    expect(report).toMatchObject({ edition: "prepared", emailsSent: 1 });
  });

  it("does not prepare an edition on a day without publication", async () => {
    await db.update(users).set({ editionFrequency: "weekdays", editionWeekdays: [1, 5] }); // Mon, Fri
    expect((await runClock(db, deps(paris("09:30")))).edition).toBe("none");
    expect(await editionOfTheDay()).toBeUndefined();
  });

  it("retries a failed preparation, then sends an alert once at 9:30", async () => {
    const broken = () => {
      throw new Error("Clé Claude manquante (réglage ANTHROPIC_API_KEY).");
    };
    await runClock(db, deps(paris("08:00"), { redacteur: broken }));
    await runClock(db, deps(paris("08:15"), { redacteur: broken }));
    await runClock(db, deps(paris("08:30"), { redacteur: broken }));
    expect(await editionOfTheDay()).toMatchObject({ status: "error", attempts: 3 });
    await runClock(db, deps(paris("09:15"), { redacteur: broken }));
    expect(sent).toEqual([]);

    await runClock(db, deps(paris("09:31"), { redacteur: broken }));
    await runClock(db, deps(paris("09:46"), { redacteur: broken }));

    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toMatch(/n'a pas pu être préparé/);
    expect(sent[0].text).toContain("Clé Claude manquante");
  });

  it("reads the sources not read for 30 minutes, the oldest first, within the time left", async () => {
    await db.insert(sources).values([
      { type: "web", displayName: "old", url: "https://old.example", key: "web:old", lastFetchedAt: paris("06:00") },
      { type: "web", displayName: "never", url: "https://never.example", key: "web:never" },
    ]);

    // 08:10: "itsnicethat" was read at 07:59 (not due), the two others are.
    expect((await runClock(db, deps(paris("07:10")))).sourcesRefreshed).toBe(2);
    // No time left: nothing is started.
    expect((await runClock(db, deps(paris("07:50"), { budgetMs: 60_000 }))).sourcesRefreshed).toBe(0);
  });

  it("an e-mail that cannot leave is retried at the next call, and does not stop the relève", async () => {
    await runClock(db, deps(paris("08:02")));
    const failing = await runClock(db, deps(paris("09:01"), { sendEmail: async () => { throw new Error("Resend en panne"); } }));
    expect(failing).toMatchObject({ emailsSent: 0, emailErrors: ["Resend en panne"] });

    expect((await runClock(db, deps(paris("09:16")))).emailsSent).toBe(1);
  });

  it("an edition prepared by hand sends no e-mail", async () => {
    const { buildEdition } = await import("@/modules/edition/build");
    await buildEdition(db, DEFAULT_USER_ID, { redacteur: createFakeRedacteur().redacteur, now: paris("08:30") });

    expect((await runClock(db, deps(paris("09:05")))).emailsSent).toBe(0);
  });
});

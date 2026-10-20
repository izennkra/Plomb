import { describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_ID } from "@/db/client";
import { sources, subscriptions, users } from "@/db/schema";
import { addSource } from "@/modules/sources/add-source";
import type { CheckWebsite } from "@/modules/sources/check-website";
import { createTestDb } from "../helpers/test-db";

const siteUp: CheckWebsite = async (url) => ({ ok: true, finalUrl: url });

describe("addSource", () => {
  it("adds an Instagram source without contacting the network", async () => {
    const db = await createTestDb();
    const checkWebsite = vi.fn(siteUp);

    const result = await addSource(db, DEFAULT_USER_ID, "instagram.com/mouthwash.studio", { checkWebsite });

    expect(result).toEqual({
      ok: true,
      alreadyFollowed: false,
      source: expect.objectContaining({ type: "instagram", displayName: "@mouthwash.studio" }),
    });
    expect(checkWebsite).not.toHaveBeenCalled();
    expect(await db.select().from(subscriptions)).toHaveLength(1);
  });

  it("checks a website and stores its final address after redirects", async () => {
    const db = await createTestDb();
    const checkWebsite = vi.fn<CheckWebsite>(async () => ({
      ok: true,
      finalUrl: "https://www.the-brandidentity.com/features/",
    }));

    const result = await addSource(db, DEFAULT_USER_ID, "http://the-brandidentity.com/features", { checkWebsite });

    expect(checkWebsite).toHaveBeenCalledWith("http://the-brandidentity.com/features");
    expect(result.ok && result.source).toMatchObject({
      url: "https://the-brandidentity.com/features",
      key: "web:the-brandidentity.com/features",
    });
  });

  it("stores a source written two different ways only once", async () => {
    const db = await createTestDb();

    await addSource(db, DEFAULT_USER_ID, "https://www.instagram.com/mouthwash.studio/?hl=fr", { checkWebsite: siteUp });
    const second = await addSource(db, DEFAULT_USER_ID, "instagram.com/mouthwash.studio", { checkWebsite: siteUp });

    expect(second).toMatchObject({ ok: true, alreadyFollowed: true });
    expect(await db.select().from(sources)).toHaveLength(1);
    expect(await db.select().from(subscriptions)).toHaveLength(1);
  });

  it("shares one source between two users", async () => {
    const db = await createTestDb();
    await db.insert(users).values({ id: "other" });

    await addSource(db, DEFAULT_USER_ID, "x.com/studiobakers", { checkWebsite: siteUp });
    const result = await addSource(db, "other", "twitter.com/StudioBakers", { checkWebsite: siteUp });

    expect(result).toMatchObject({ ok: true, alreadyFollowed: false });
    expect(await db.select().from(sources)).toHaveLength(1);
    expect(await db.select().from(subscriptions)).toHaveLength(2);
  });

  it("does not contact a website that is already known", async () => {
    const db = await createTestDb();
    await addSource(db, DEFAULT_USER_ID, "itsnicethat.com", { checkWebsite: siteUp });
    const checkWebsite = vi.fn(siteUp);

    await addSource(db, DEFAULT_USER_ID, "https://www.itsnicethat.com/", { checkWebsite });

    expect(checkWebsite).not.toHaveBeenCalled();
  });

  it("returns the recognition error and stores nothing", async () => {
    const db = await createTestDb();

    const result = await addSource(db, DEFAULT_USER_ID, "bonjour", { checkWebsite: siteUp });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/pas une adresse valide/) });
    expect(await db.select().from(sources)).toHaveLength(0);
  });

  it("returns the website error and stores nothing", async () => {
    const db = await createTestDb();
    const checkWebsite: CheckWebsite = async () => ({ ok: false, error: "Cette page n'existe pas (erreur 404)." });

    const result = await addSource(db, DEFAULT_USER_ID, "example.com/nope", { checkWebsite });

    expect(result).toEqual({ ok: false, error: "Cette page n'existe pas (erreur 404)." });
    expect(await db.select().from(sources)).toHaveLength(0);
  });
});

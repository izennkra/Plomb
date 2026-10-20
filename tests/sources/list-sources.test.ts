import { describe, expect, it } from "vitest";
import { DEFAULT_USER_ID } from "@/db/client";
import { users } from "@/db/schema";
import { addSource } from "@/modules/sources/add-source";
import type { CheckWebsite } from "@/modules/sources/check-website";
import { listSources } from "@/modules/sources/list-sources";
import { createTestDb } from "../helpers/test-db";

const siteUp: CheckWebsite = async (url) => ({ ok: true, finalUrl: url });

describe("listSources", () => {
  it("lists only the sources followed by the user, newest first", async () => {
    const db = await createTestDb();
    await db.insert(users).values({ id: "other" });
    await addSource(db, DEFAULT_USER_ID, "instagram.com/mouthwash.studio", { checkWebsite: siteUp });
    await addSource(db, DEFAULT_USER_ID, "x.com/studiobakers", { checkWebsite: siteUp });
    await addSource(db, "other", "itsnicethat.com", { checkWebsite: siteUp });

    const list = await listSources(db, DEFAULT_USER_ID);

    expect(list.map((source) => source.displayName)).toEqual(["@studiobakers", "@mouthwash.studio"]);
  });

  it("returns an empty list when nothing is followed", async () => {
    const db = await createTestDb();
    expect(await listSources(db, DEFAULT_USER_ID)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_USER_ID } from "@/db/client";
import { users } from "@/db/schema";
import { addSource } from "@/modules/sources/add-source";
import { setFavorite } from "@/modules/sources/favorite";
import { listSources } from "@/modules/sources/list-sources";
import { createTestDb } from "../helpers/test-db";

describe("favourite sources", () => {
  it("marks and unmarks a source, for this user only", async () => {
    const db = await createTestDb();
    await db.insert(users).values({ id: "other" });
    const added = await addSource(db, DEFAULT_USER_ID, "instagram.com/mouthwash.studio");
    if (!added.ok) throw new Error(added.error);
    await addSource(db, "other", "instagram.com/mouthwash.studio");

    expect(await setFavorite(db, DEFAULT_USER_ID, added.source.id, true)).toBe(true);
    expect((await listSources(db, DEFAULT_USER_ID))[0].favorite).toBe(true);
    expect((await listSources(db, "other"))[0].favorite).toBe(false);

    await setFavorite(db, DEFAULT_USER_ID, added.source.id, false);
    expect((await listSources(db, DEFAULT_USER_ID))[0].favorite).toBe(false);
  });

  it("does nothing for a source the user does not follow", async () => {
    const db = await createTestDb();
    expect(await setFavorite(db, DEFAULT_USER_ID, 999, true)).toBe(false);
  });
});

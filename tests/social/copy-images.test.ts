import { describe, expect, it } from "vitest";
import { media } from "@/db/schema";
import { copyImages, MAX_COPIED_IMAGES } from "@/modules/social/copy-images";
import { createDbMediaStore, readMedia } from "@/modules/social/media-store";
import { createTestDb } from "../helpers/test-db";

const fakeImage = async (url: string) => (url.includes("broken") ? null : { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });

describe("copyImages (copies kept in Plomb's database)", () => {
  it("copies the images and returns lasting addresses; a broken one keeps its address", async () => {
    const db = await createTestDb();
    const copies = await copyImages(["https://cdn.instagram.com/a.jpg?oe=1", "https://cdn.instagram.com/broken.jpg"], createDbMediaStore(db), {
      fetchImage: fakeImage,
    });
    expect(copies[0]).toMatch(/^\/media\/[0-9a-f]{40}\.jpg$/);
    expect(copies[1]).toBe("https://cdn.instagram.com/broken.jpg");
    expect(await readMedia(db, copies[0].slice("/media/".length))).toMatchObject({ contentType: "image/jpeg" });
  });

  it("keeps a whole Instagram carousel (up to 20 slides), each image once", async () => {
    const db = await createTestDb();
    const store = createDbMediaStore(db);
    const urls = Array.from({ length: 25 }, (_, i) => `https://cdn.instagram.com/${i}.jpg`);
    expect(await copyImages(urls, store, { fetchImage: fakeImage })).toHaveLength(MAX_COPIED_IMAGES);
    await copyImages(urls.slice(0, 3), store, { fetchImage: fakeImage });
    expect(await db.select().from(media)).toHaveLength(20);
  });

  it("removes only its own copies", async () => {
    const db = await createTestDb();
    const store = createDbMediaStore(db);
    const [copy] = await copyImages(["https://cdn.instagram.com/a.jpg"], store, { fetchImage: fakeImage });
    await store.remove([copy, "https://elsewhere.example/x.jpg"]);
    expect(await db.select().from(media)).toHaveLength(0);
    expect(store.owns(copy)).toBe(true);
    expect(store.owns("https://elsewhere.example/x.jpg")).toBe(false);
  });
});

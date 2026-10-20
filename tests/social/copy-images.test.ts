import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyImages, MAX_COPIED_IMAGES } from "@/modules/social/copy-images";
import { createLocalStore } from "@/modules/social/media-store";

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const tempStore = () => {
  const dir = mkdtempSync(join(tmpdir(), "plomb-media-"));
  dirs.push(dir);
  return { dir, store: createLocalStore(dir) };
};
const fakeImage = async (url: string) => (url.includes("broken") ? null : { bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });

describe("copyImages", () => {
  it("copies the images and returns lasting addresses; a broken one keeps its address", async () => {
    const { dir, store } = tempStore();
    const copies = await copyImages(["https://cdn.instagram.com/a.jpg?oe=1", "https://cdn.instagram.com/broken.jpg"], store, {
      fetchImage: fakeImage,
    });
    expect(copies[0]).toMatch(/^\/media\/[0-9a-f]{40}\.jpg$/);
    expect(copies[1]).toBe("https://cdn.instagram.com/broken.jpg");
    expect(readdirSync(dir)).toHaveLength(1);
  });

  it("copies at most 8 images per post", async () => {
    const { store } = tempStore();
    const urls = Array.from({ length: 14 }, (_, i) => `https://cdn.instagram.com/${i}.jpg`);
    expect(await copyImages(urls, store, { fetchImage: fakeImage })).toHaveLength(MAX_COPIED_IMAGES);
  });

  it("removes only its own copies", async () => {
    const { dir, store } = tempStore();
    const [copy] = await copyImages(["https://cdn.instagram.com/a.jpg"], store, { fetchImage: fakeImage });
    await store.remove([copy, "https://elsewhere.example/x.jpg"]);
    expect(readdirSync(dir)).toHaveLength(0);
    expect(store.owns(copy)).toBe(true);
    expect(store.owns("https://elsewhere.example/x.jpg")).toBe(false);
  });
});

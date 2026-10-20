import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, put } from "@vercel/blob";

/** Where copies of expiring images (Instagram, LinkedIn) are kept. */
export type MediaStore = {
  /** Stores the image and returns its lasting address. */
  save(name: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** Deletes copies (addresses returned by `save`); other addresses are ignored. */
  remove(urls: string[]): Promise<void>;
  owns(url: string): boolean;
};

/** Online: Vercel Blob (free up to 1 GB), with BLOB_READ_WRITE_TOKEN. */
export function createBlobStore(token: string): MediaStore {
  const owns = (url: string) => /\.public\.blob\.vercel-storage\.com\//.test(url);
  return {
    async save(name, bytes, contentType) {
      const { url } = await put(`media/${name}`, Buffer.from(bytes), {
        access: "public",
        contentType,
        token,
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return url;
    },
    async remove(urls) {
      const mine = urls.filter(owns);
      if (mine.length > 0) await del(mine, { token });
    },
    owns,
  };
}

/** On the Mac: the public/media folder, served by the app at /media/…. */
export function createLocalStore(dir = join(process.cwd(), "public", "media")): MediaStore {
  const owns = (url: string) => url.startsWith("/media/");
  return {
    async save(name, bytes) {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, name), bytes);
      return `/media/${name}`;
    },
    async remove(urls) {
      for (const url of urls.filter(owns)) await rm(join(dir, url.slice("/media/".length)), { force: true });
    },
    owns,
  };
}

export function getMediaStore(): MediaStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return token ? createBlobStore(token) : createLocalStore();
}

/** Same image address = same file name: copying twice costs nothing more. */
export function mediaName(url: string, contentType: string): string {
  const extension = /png/.test(contentType) ? "png" : /webp/.test(contentType) ? "webp" : /gif/.test(contentType) ? "gif" : "jpg";
  return `${createHash("sha1").update(url).digest("hex")}.${extension}`;
}

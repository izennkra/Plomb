import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { media } from "@/db/schema";

/** Where copies of expiring images (Instagram, LinkedIn) are kept. */
export type MediaStore = {
  /** Stores the image and returns its lasting address. */
  save(name: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** Deletes copies (addresses returned by `save`); other addresses are ignored. */
  remove(urls: string[]): Promise<void>;
  owns(url: string): boolean;
};

export const MEDIA_PATH = "/media/";

/**
 * Copies live in Plomb's own database (Turso online: 5 GB free, no limit on the number of uploads) and are served
 * by the app at /media/<name>. Nothing else to set up.
 */
export function createDbMediaStore(db: Db): MediaStore {
  const owns = (url: string) => url.startsWith(MEDIA_PATH);
  return {
    async save(name, bytes, contentType) {
      await db
        .insert(media)
        .values({ name, contentType, data: Buffer.from(bytes) })
        .onConflictDoNothing();
      return `${MEDIA_PATH}${name}`;
    },
    async remove(urls) {
      const names = urls.filter(owns).map((url) => url.slice(MEDIA_PATH.length));
      if (names.length > 0) await db.delete(media).where(inArray(media.name, names));
    },
    owns,
  };
}

export async function readMedia(db: Db, name: string): Promise<{ contentType: string; data: Buffer } | null> {
  const row = await db.query.media.findFirst({ where: eq(media.name, name) });
  return row ? { contentType: row.contentType, data: row.data } : null;
}

/** Same image address = same name: copying twice costs nothing more. */
export function mediaName(url: string, contentType: string): string {
  const extension = /png/.test(contentType) ? "png" : /webp/.test(contentType) ? "webp" : /gif/.test(contentType) ? "gif" : "jpg";
  return `${createHash("sha1").update(url).digest("hex")}.${extension}`;
}

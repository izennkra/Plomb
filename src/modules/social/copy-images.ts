import { safeFetch } from "@/modules/fetching/safe-fetch";
import { mediaName, type MediaStore } from "./media-store";

/** Every slide of a carousel is kept (Instagram allows 20). */
export const MAX_COPIED_IMAGES = 20;
const MAX_IMAGE_BYTES = 8_000_000;

export type DownloadImage = (url: string) => Promise<{ bytes: Uint8Array; contentType: string } | null>;

const download: DownloadImage = async (url) => {
  const response = await safeFetch(url, { binary: true, maxBytes: MAX_IMAGE_BYTES, headers: { accept: "image/*" } });
  if (!response.ok || response.status !== 200 || !response.bytes || !response.contentType.startsWith("image/")) return null;
  return { bytes: response.bytes, contentType: response.contentType };
};

/**
 * Copies a post's images into Plomb's storage as soon as it arrives (their original addresses expire after a few days):
 * the whole carousel, in original quality. An image that cannot be copied keeps its original address.
 */
export async function copyImages(
  images: string[],
  store: MediaStore,
  { fetchImage = download }: { fetchImage?: DownloadImage } = {},
): Promise<string[]> {
  const copies: string[] = [];
  for (const url of images.slice(0, MAX_COPIED_IMAGES)) {
    try {
      const image = await fetchImage(url);
      copies.push(image ? await store.save(mediaName(url, image.contentType), image.bytes, image.contentType) : url);
    } catch {
      copies.push(url);
    }
  }
  return copies;
}

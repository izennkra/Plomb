import { getDb } from "@/db";
import { readMedia } from "@/modules/social/media-store";

/** A copy of a social image (public, like the post it comes from; its name cannot be guessed). */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[0-9a-f]{40}\.(jpg|png|webp|gif)$/.test(name)) return new Response("Introuvable", { status: 404 });
  const image = await readMedia(await getDb(), name);
  if (!image) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "content-type": image.contentType,
      // A copy never changes: browsers keep it.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

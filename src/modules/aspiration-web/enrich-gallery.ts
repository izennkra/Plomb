import type { PageFetcher } from "@/modules/fetching/polite-fetch";
import { readArticle } from "./article";

/**
 * Some feeds give a single image per article (It's Nice That) while the article page shows the whole project:
 * in that case the page is read for its gallery. Returns the richer gallery.
 */
export async function richerGallery(url: string, images: string[], fetchPage: PageFetcher): Promise<string[]> {
  if (images.length > 1) return images;
  const response = await fetchPage(url);
  if (!response.ok || response.status !== 200) return images;
  const article = readArticle(response.body, response.url);
  return article.ok && article.post.images.length > images.length ? article.post.images : images;
}

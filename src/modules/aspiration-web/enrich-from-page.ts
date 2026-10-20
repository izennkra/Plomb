import type { PageFetcher } from "@/modules/fetching/polite-fetch";
import { readArticle } from "./article";
import type { PostCandidate } from "./post";

/** Below this, a feed only gave an extract: the AI editor needs the whole article. */
export const SHORT_CONTENT = 1000;

/**
 * Some feeds give a single image and a short extract per article (It's Nice That) while the article page has the whole
 * project and text. In that case the page is read once, for both. Returns the richer gallery and text.
 */
export async function enrichFromPage(
  post: Pick<PostCandidate, "url" | "images" | "content">,
  fetchPage: PageFetcher,
): Promise<{ images: string[]; content: string | null }> {
  const current = { images: post.images, content: post.content };
  if (post.images.length > 1 && (post.content?.length ?? 0) >= SHORT_CONTENT) return current;

  const response = await fetchPage(post.url);
  if (!response.ok || response.status !== 200) return current;
  const article = readArticle(response.body, response.url);
  if (!article.ok) return current;
  return {
    images: article.post.images.length > post.images.length ? article.post.images : post.images,
    content: (article.post.content?.length ?? 0) > (post.content?.length ?? 0) ? article.post.content : post.content,
  };
}

/** Gallery only (used to complete galleries of already stored articles). */
export async function richerGallery(url: string, images: string[], fetchPage: PageFetcher): Promise<string[]> {
  if (images.length > 1) return images;
  return (await enrichFromPage({ url, images, content: "x".repeat(SHORT_CONTENT) }, fetchPage)).images;
}

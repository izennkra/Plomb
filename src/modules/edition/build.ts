import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editionItems, editions, type Edition } from "@/db/schema";
import type { ArticleSummary, Redacteur } from "./redacteur/types";
import { selectEditionPosts, type EditionPost } from "./select";

/** A favourite source's article counts as if it were this much more important. */
export const FAVORITE_BONUS = 2;
/** The Une: 1 major article + 2 secondary ones. */
const UNE_SIZE = 3;
/** Note given when the AI could not judge an article. */
const DEFAULT_IMPORTANCE = 5;

type Written = { post: EditionPost; summary: ArticleSummary; fallback: boolean; score: number };

/**
 * Prepares the user's edition of the day: the editor writes every new article, the most important ones make the Une
 * (favourite sources get a bonus), the rest follows by importance. Preparing again the same day replaces the edition.
 */
export async function buildEdition(
  db: Db,
  userId: string,
  { redacteur, now = new Date() }: { redacteur: Redacteur; now?: Date },
): Promise<Edition> {
  const selection = await selectEditionPosts(db, userId, { now });
  const edition = await startEdition(db, userId, selection.day, selection.periodStart, selection.periodEnd, redacteur.model);

  try {
    const written: Written[] = [];
    for (const post of selection.posts) {
      const article = { title: post.title, content: post.content, excerpt: post.excerpt, sourceName: post.sourceName };
      const summary = await redacteur.summarize(article).catch(() => null);
      const final = summary ?? fallbackSummary(post);
      written.push({ post, summary: final, fallback: !summary, score: final.importance + (post.favorite ? FAVORITE_BONUS : 0) });
    }
    // Most important first; on a tie, favourites, then the richer gallery.
    written.sort(
      (a, b) =>
        b.score - a.score ||
        Number(b.post.favorite) - Number(a.post.favorite) ||
        b.post.images.length - a.post.images.length,
    );

    const items = [];
    for (const [index, entry] of written.entries()) {
      const { post, summary, fallback } = entry;
      const placement = index === 0 ? "une" : index < UNE_SIZE ? "secondaire" : "suite";
      const leadText =
        placement === "suite" || fallback
          ? null
          : await redacteur
              .writeLead({ title: post.title, content: post.content, excerpt: post.excerpt, sourceName: post.sourceName })
              .catch(() => null);
      items.push({
        editionId: edition.id,
        postId: post.postId,
        position: index + 1,
        placement,
        title: summary.title,
        summary: summary.summary,
        leadText,
        theme: fallback ? null : summary.theme,
        importance: fallback ? null : summary.importance,
        url: post.url,
        images: post.images,
        sourceName: post.sourceName,
        favorite: post.favorite,
        fallback,
      } as const);
    }
    if (items.length > 0) await db.insert(editionItems).values(items);

    const message =
      items.length === 0
        ? "Pas de nouvelles de vos sources depuis la dernière édition."
        : `${items.length} article${items.length > 1 ? "s" : ""}`;
    return await finish(db, edition.id, { status: "ready", message });
  } catch (error) {
    await finish(db, edition.id, { status: "error", message: "La préparation de l'édition a échoué." });
    throw error;
  }
}

/** Creates the edition of the day, or resets it when it is prepared again. */
async function startEdition(db: Db, userId: string, day: string, periodStart: Date, periodEnd: Date, model: string) {
  const existing = await db.query.editions.findFirst({ where: and(eq(editions.userId, userId), eq(editions.day, day)) });
  if (existing) {
    await db.delete(editionItems).where(eq(editionItems.editionId, existing.id));
    const [edition] = await db
      .update(editions)
      .set({ status: "building", periodStart, periodEnd, model, message: null, createdAt: new Date() })
      .where(eq(editions.id, existing.id))
      .returning();
    return edition;
  }
  const [edition] = await db.insert(editions).values({ userId, day, periodStart, periodEnd, model }).returning();
  return edition;
}

async function finish(db: Db, id: number, values: Pick<Edition, "status" | "message">): Promise<Edition> {
  const [edition] = await db.update(editions).set(values).where(eq(editions.id, id)).returning();
  return edition;
}

/** When the AI fails on an article, the media's own title and summary are used: the edition still comes out. */
function fallbackSummary(post: EditionPost): ArticleSummary {
  return { title: post.title, summary: post.excerpt ?? "", theme: "Culture & métier", importance: DEFAULT_IMPORTANCE };
}

import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { editionItems, editions, users, type Edition, type EditionItem } from "@/db/schema";
import type { ArticleSummary, Redacteur } from "./redacteur/types";
import { groupEchoes } from "./echo";
import { mapInParallel } from "./parallel";
import { parisDay } from "./paris-time";
import { coverageDays, toSchedule } from "./schedule";
import { importanceOf, type Criteria } from "./scoring";
import { selectEditionPosts, type EditionPost } from "./select";

/** The Une: 1 major article + 2 secondary ones. */
const UNE_SIZE = 3;
/** Stories compared side by side in the editorial meeting. */
const MEETING_SIZE = 8;
/** Criteria given when the AI could not judge an article: an average story. */
const DEFAULT_CRITERIA: Criteria = { notoriety: 3, scale: 3, authors: 3, reach: 3, quality: 3 };

type Written = { post: EditionPost; summary: ArticleSummary; fallback: boolean; score: number; coveredBy: string[] };

/**
 * Prepares the user's edition of the day: the editor writes and judges every new article, the most important ones make
 * the Une, the rest follows by importance. Favourite sources get no ranking advantage (they are only highlighted).
 * Preparing again the same day replaces the edition.
 */
export async function buildEdition(
  db: Db,
  userId: string,
  { redacteur, now = new Date(), testMode = false }: { redacteur: Redacteur; now?: Date; testMode?: boolean },
): Promise<Edition> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const schedule = toSchedule(user?.editionFrequency, user?.editionWeekdays);
  const selection = await selectEditionPosts(db, userId, { now, testMode, coverageDays: coverageDays(schedule, parisDay(now)) });
  const edition = await startEdition(db, userId, selection.day, selection.periodStart, selection.periodEnd, redacteur.model);

  try {
    // Several articles are written at the same time when the editor allows it (online AI).
    const written: Written[] = await mapInParallel(selection.posts, redacteur.parallel, async (post) => {
      const article = { title: post.title, content: post.content, excerpt: post.excerpt, sourceName: post.sourceName };
      const summary = await redacteur.summarize(article).catch(() => null);
      const final = summary ?? fallbackSummary(post);
      return { post, summary: final, fallback: !summary, score: final.importance, coveredBy: [] };
    });

    // The same story covered by several media appears once (the best article), and counts as a bigger story.
    const isBetter = (a: Written, b: Written) => a.score > b.score || (a.score === b.score && a.post.images.length > b.post.images.length);
    const stories = groupEchoes(
      written.map((entry) => ({ item: entry, subject: entry.fallback ? null : entry.summary.subject, source: entry.post.sourceName })),
      isBetter,
    ).map(({ item, coveredBy }) => ({
      ...item,
      coveredBy,
      score: item.fallback ? item.score : importanceOf(item.summary.criteria, coveredBy.length),
    }));

    // Most important first; on a tie, the richer gallery.
    stories.sort((a, b) => b.score - a.score || b.post.images.length - a.post.images.length);
    // Editorial meeting: the editor compares the best stories side by side and picks the Une.
    const ranked = await editorialMeeting(stories, redacteur);

    // Longer texts for the 3 articles of the Une, written together.
    const leads = await mapInParallel(ranked.slice(0, UNE_SIZE), redacteur.parallel, (entry) =>
      entry.fallback
        ? Promise.resolve(null)
        : redacteur
            .writeLead({
              title: entry.post.title,
              content: entry.post.content,
              excerpt: entry.post.excerpt,
              sourceName: entry.post.sourceName,
            })
            .catch(() => null),
    );

    const items: (typeof editionItems.$inferInsert)[] = ranked.map((entry, index) => {
      const { post, summary, fallback } = entry;
      const placement: EditionItem["placement"] = index === 0 ? "une" : index < UNE_SIZE ? "secondaire" : "suite";
      return {
        editionId: edition.id,
        postId: post.postId,
        position: index + 1,
        placement,
        title: summary.title,
        summary: summary.summary,
        leadText: leads[index] ?? null,
        theme: fallback ? null : summary.theme,
        importance: fallback ? null : Math.round(entry.score),
        subject: fallback ? null : summary.subject || null,
        criteria: fallback ? null : summary.criteria,
        coveredBy: entry.coveredBy,
        url: post.url,
        images: post.images,
        sourceName: post.sourceName,
        favorite: post.favorite,
        fallback,
      };
    });
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

/**
 * Puts the Une chosen by the editor first (1 major + 2 secondary), then the rest by importance.
 * Without a usable choice, the order of the notes stands.
 */
async function editorialMeeting<T extends Written>(stories: T[], redacteur: Redacteur): Promise<T[]> {
  const candidates = stories.slice(0, MEETING_SIZE).filter((story) => !story.fallback);
  if (candidates.length < 2) return stories;
  try {
    const choice = await redacteur.chooseFrontPage(
      candidates.map((story) => ({
        title: story.summary.title,
        summary: story.summary.summary,
        subject: story.summary.subject,
        sourceName: story.post.sourceName,
        coveredBy: story.coveredBy,
        importance: story.score,
      })),
    );
    const front = [choice.une, ...choice.secondary].map((index) => candidates[index]);
    if (front.some((story) => !story) || new Set(front).size !== front.length) return stories;
    return [...front, ...stories.filter((story) => !front.includes(story))];
  } catch {
    return stories;
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
  return {
    title: post.title,
    summary: post.excerpt ?? "",
    theme: "Culture & métier",
    subject: "",
    criteria: DEFAULT_CRITERIA,
    importance: importanceOf(DEFAULT_CRITERIA),
  };
}

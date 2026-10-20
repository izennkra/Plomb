import { sql } from "drizzle-orm";
import { blob, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

/** A source is stored once, shared by every user who follows it. */
export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["web", "youtube", "instagram", "x", "linkedin"] }).notNull(),
  displayName: text("display_name").notNull(),
  url: text("url").notNull(),
  key: text("key").notNull().unique(),
  createdAt: createdAt(),
  /** How articles were last read successfully: remembered to go straight to the right level. */
  fetchMethod: text("fetch_method", { enum: ["rss", "page"] }),
  feedUrl: text("feed_url"),
  lastFetchedAt: integer("last_fetched_at", { mode: "timestamp" }),
  lastFetchStatus: text("last_fetch_status", { enum: ["ok", "error", "running"] }),
  /** Error message shown to the user, or the number of new articles on success. */
  lastFetchMessage: text("last_fetch_message"),
  /** Logo or profile picture of the source (copied into Plomb), for its tile on the Sources page. */
  imageUrl: text("image_url"),
  /** When Plomb last looked for that picture (looked for again after a while when none was found). */
  imageCheckedAt: integer("image_checked_at", { mode: "timestamp" }),
});

/** An article (or post) published by a source. Stored once per source, identified by its cleaned address. */
export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    imageUrl: text("image_url"),
    /** Gallery of the article (main image first), shown in the card's carousel. */
    images: text("images", { mode: "json" }).$type<string[]>(),
    /** Publication date given by the site, when there is one. */
    publishedAt: integer("published_at", { mode: "timestamp" }),
    discoveredAt: integer("discovered_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** Full text, for the AI editor only: never displayed. */
    content: text("content"),
    method: text("method", { enum: ["rss", "page", "social"] }).notNull(),
    /** Already published when the source was added: a starting point, not news. */
    beforeSubscription: integer("before_subscription", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    uniqueIndex("posts_source_url_unique").on(table.sourceId, table.url),
    index("posts_source_idx").on(table.sourceId, table.discoveredAt),
  ],
);

/**
 * A request sent to Apify for a social source (Instagram, X, LinkedIn): started by the clock, results read at a later
 * call (the scraper takes a minute or two).
 */
export const socialRuns = sqliteTable(
  "social_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    runId: text("run_id").notNull(),
    datasetId: text("dataset_id").notNull(),
    status: text("status", { enum: ["running", "done", "failed"] }).notNull().default("running"),
    startedAt: createdAt(),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
    message: text("message"),
  },
  (table) => [index("social_runs_status_idx").on(table.status, table.sourceId)],
);

/**
 * Copies of social images (Instagram and LinkedIn addresses expire after a few days), served by Plomb at /media/<name>.
 * Deleted with their posts after 7 days.
 */
export const media = sqliteTable("media", {
  /** "<sha1 of the original address>.<extension>": copying the same image twice costs nothing. */
  name: text("name").primaryKey(),
  contentType: text("content_type").notNull(),
  data: blob("data", { mode: "buffer" }).notNull(),
  createdAt: createdAt(),
});

/**
 * Every article address already listed by a source, read or not: only addresses that appear later are news.
 * (A first relève reads 20 articles out of maybe 40 listed: the other 20 are old, not news.)
 */
export const seenLinks = sqliteTable(
  "seen_links",
  {
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    seenAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.sourceId, table.url] })],
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  createdAt: createdAt(),
  /** How often the journal comes out (always at 9:00): daily, every 3 days, or chosen weekdays. */
  editionFrequency: text("edition_frequency", { enum: ["daily", "every3days", "weekdays"] }).notNull().default("daily"),
  /** Chosen weekdays, 1 (Monday) to 7 (Sunday). */
  editionWeekdays: text("edition_weekdays", { mode: "json" }).$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
});

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    /** Favourite sources come first in the edition and are highlighted. */
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.userId, table.sourceId] })],
);

export type Source = typeof sources.$inferSelect;
export type Post = typeof posts.$inferSelect;

export const THEMES = [
  "Identité",
  "Typographie",
  "Packaging",
  "Édition",
  "Digital & motion",
  "Illustration & photo",
  "Culture & métier",
] as const;

/** The morning edition of one user's journal. */
export const editions = sqliteTable(
  "editions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Day of the edition (Paris), e.g. "2026-10-21". */
    day: text("day").notNull(),
    /** Articles discovered in [periodStart, periodEnd) are in this edition. */
    periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
    periodEnd: integer("period_end", { mode: "timestamp" }).notNull(),
    status: text("status", { enum: ["building", "ready", "error"] }).notNull().default("building"),
    model: text("model"),
    language: text("language").notNull().default("fr"),
    message: text("message"),
    createdAt: createdAt(),
    /** Shown from this moment (9:00 for the automatic edition; at once when prepared by hand). */
    publishAt: integer("publish_at", { mode: "timestamp" }),
    /** The 9:00 e-mail: sent once. */
    emailSentAt: integer("email_sent_at", { mode: "timestamp" }),
    /** "Your journal could not be prepared": sent once. */
    alertSentAt: integer("alert_sent_at", { mode: "timestamp" }),
    /** Preparation attempts (the clock retries a failed edition a few times). */
    attempts: integer("attempts").notNull().default(0),
  },
  (table) => [uniqueIndex("editions_user_day_unique").on(table.userId, table.day)],
);

/**
 * An article of an edition. Keeps its own copy of what is shown (texts written by the AI, images, link),
 * so an edition stays readable after its articles are deleted (one week of publications is kept).
 */
export const editionItems = sqliteTable(
  "edition_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    postId: integer("post_id").references(() => posts.id, { onDelete: "set null" }),
    position: integer("position").notNull(),
    placement: text("placement", { enum: ["une", "secondaire", "suite"] }).notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    /** Longer text, for the 3 articles of the Une. */
    leadText: text("lead_text"),
    theme: text("theme", { enum: THEMES }),
    importance: integer("importance"),
    /** Main subject named by the editor ("Coca-Cola"). */
    subject: text("subject"),
    /** Notes behind the importance (notoriety, scale, authors, reach, quality — 1 to 5). */
    criteria: text("criteria", { mode: "json" }).$type<Record<string, number>>(),
    /** Other media that covered the same subject: a sign of a big story. */
    coveredBy: text("covered_by", { mode: "json" }).$type<string[]>().notNull().default([]),
    url: text("url").notNull(),
    images: text("images", { mode: "json" }).$type<string[]>().notNull(),
    sourceName: text("source_name").notNull(),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    /** The AI could not write this article: the media's own title and summary are shown. */
    fallback: integer("fallback", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("edition_items_edition_idx").on(table.editionId, table.position)],
);

export type Edition = typeof editions.$inferSelect;
export type EditionItem = typeof editionItems.$inferSelect;

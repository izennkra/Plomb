import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

/** A source is stored once, shared by every user who follows it. */
export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["web", "instagram", "x", "linkedin"] }).notNull(),
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
    /** Publication date given by the site, when there is one. */
    publishedAt: integer("published_at", { mode: "timestamp" }),
    discoveredAt: integer("discovered_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /** Full text, for the AI editor only: never displayed. */
    content: text("content"),
    method: text("method", { enum: ["rss", "page"] }).notNull(),
    /** Already published when the source was added: a starting point, not news. */
    beforeSubscription: integer("before_subscription", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    uniqueIndex("posts_source_url_unique").on(table.sourceId, table.url),
    index("posts_source_idx").on(table.sourceId, table.discoveredAt),
  ],
);

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
  },
  (table) => [primaryKey({ columns: [table.userId, table.sourceId] })],
);

export type Source = typeof sources.$inferSelect;
export type Post = typeof posts.$inferSelect;

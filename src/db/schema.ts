import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
});

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

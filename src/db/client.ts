import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

/** Until accounts exist (brick `comptes-abonnement`), everything belongs to this user. */
export const DEFAULT_USER_ID = "local";

export const DEFAULT_DATABASE_URL = "file:data/plomb.db";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(url: string = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL): Db {
  if (url.startsWith("file:")) {
    const dir = url.slice("file:".length).split("/").slice(0, -1).join("/");
    if (dir) mkdirSync(dir, { recursive: true });
  }
  return drizzle(createClient({ url }), { schema });
}

/** Applies pending migrations, enables foreign keys and creates the default user. */
export async function prepareDb(db: Db): Promise<void> {
  await db.run("PRAGMA foreign_keys = ON");
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(schema.users).values({ id: DEFAULT_USER_ID }).onConflictDoNothing();
}

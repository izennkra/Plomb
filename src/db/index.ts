import "server-only";
import { createDb, prepareDb, type Db } from "./client";

// Kept on globalThis so hot reloads in development reuse the same connection.
const cache = globalThis as unknown as { plombDb?: Promise<Db> };

/** The app's database, migrated and ready on first use. */
export function getDb(): Promise<Db> {
  cache.plombDb ??= (async () => {
    const db = createDb();
    await prepareDb(db);
    return db;
  })();
  return cache.plombDb;
}

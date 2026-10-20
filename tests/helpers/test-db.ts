import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import { createDb, prepareDb, type Db } from "@/db/client";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A fresh, migrated database in a temporary file, deleted after each test. */
export async function createTestDb(): Promise<Db> {
  const dir = mkdtempSync(join(tmpdir(), "plomb-test-"));
  dirs.push(dir);
  const db = createDb(`file:${join(dir, "test.db")}`);
  await prepareDb(db);
  return db;
}

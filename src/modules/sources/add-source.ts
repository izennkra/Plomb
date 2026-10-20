import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sources, subscriptions, type Source } from "@/db/schema";
import { checkWebsite as defaultCheckWebsite, type CheckWebsite } from "./check-website";
import { parseSourceUrl, type ParsedSource } from "./parse-url";

export type AddSourceResult =
  | { ok: true; source: Source; alreadyFollowed: boolean }
  | { ok: false; error: string };

/**
 * Subscribes a user to the source behind a pasted URL.
 * The source is stored once and shared by every user who follows it.
 */
export async function addSource(
  db: Db,
  userId: string,
  input: string,
  { checkWebsite = defaultCheckWebsite }: { checkWebsite?: CheckWebsite } = {},
): Promise<AddSourceResult> {
  const parsed = parseSourceUrl(input);
  if (!parsed.ok) return parsed;

  let source = await findByKey(db, parsed.source.key);
  if (!source) {
    const verified = await verify(parsed.source, checkWebsite);
    if (!verified.ok) return verified;
    source = (await findByKey(db, verified.source.key)) ?? (await insert(db, verified.source));
  }

  const inserted = await db
    .insert(subscriptions)
    .values({ userId, sourceId: source.id })
    .onConflictDoNothing()
    .returning();

  return { ok: true, source, alreadyFollowed: inserted.length === 0 };
}

/** Websites are contacted; their final address (after redirects) becomes the reference. */
async function verify(
  source: ParsedSource,
  checkWebsite: CheckWebsite,
): Promise<{ ok: true; source: ParsedSource } | { ok: false; error: string }> {
  if (source.type !== "web") return { ok: true, source };

  const check = await checkWebsite(source.url);
  if (!check.ok) return check;

  const final = parseSourceUrl(check.finalUrl);
  return { ok: true, source: final.ok && final.source.type === "web" ? final.source : source };
}

async function findByKey(db: Db, key: string): Promise<Source | undefined> {
  return db.query.sources.findFirst({ where: eq(sources.key, key) });
}

async function insert(db: Db, source: ParsedSource): Promise<Source> {
  // Another request may have stored the same source in the meantime: keep the existing row.
  await db.insert(sources).values(source).onConflictDoNothing();
  return (await findByKey(db, source.key))!;
}

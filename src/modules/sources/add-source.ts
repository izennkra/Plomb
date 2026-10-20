import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sources, subscriptions, type Source } from "@/db/schema";
import { checkWebsite as defaultCheckWebsite, type CheckWebsite } from "./check-website";
import { findYoutubeChannel, type FindChannel } from "./find-channel";
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
  {
    checkWebsite = defaultCheckWebsite,
    findChannel = findYoutubeChannel,
  }: { checkWebsite?: CheckWebsite; findChannel?: FindChannel } = {},
): Promise<AddSourceResult> {
  const parsed = parseSourceUrl(input);
  if (!parsed.ok) return parsed;

  let source = await findByKey(db, parsed.source.key);
  if (!source) {
    const verified = await verify(parsed.source, checkWebsite, findChannel);
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

type Verified = ParsedSource & { feedUrl?: string };

/**
 * Websites are contacted; their final address (after redirects) becomes the reference.
 * YouTube channels are opened to find their feed, remembered for the relève.
 */
async function verify(
  source: ParsedSource,
  checkWebsite: CheckWebsite,
  findChannel: FindChannel,
): Promise<{ ok: true; source: Verified } | { ok: false; error: string }> {
  if (source.type === "youtube") {
    const channel = await findChannel(source.url);
    if (!channel.ok) return channel;
    return { ok: true, source: { ...source, feedUrl: channel.feedUrl } };
  }
  if (source.type !== "web") return { ok: true, source };

  const check = await checkWebsite(source.url);
  if (!check.ok) return check;

  const final = parseSourceUrl(check.finalUrl);
  return { ok: true, source: final.ok && final.source.type === "web" ? final.source : source };
}

async function findByKey(db: Db, key: string): Promise<Source | undefined> {
  return db.query.sources.findFirst({ where: eq(sources.key, key) });
}

async function insert(db: Db, source: Verified): Promise<Source> {
  // Another request may have stored the same source in the meantime: keep the existing row.
  await db
    .insert(sources)
    .values({ ...source, fetchMethod: source.feedUrl ? "rss" : undefined })
    .onConflictDoNothing();
  return (await findByKey(db, source.key))!;
}

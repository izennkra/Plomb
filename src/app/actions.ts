"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import { socialRuns, sources } from "@/db/schema";
import {
  FEED_SOURCE_TYPES,
  isFeedSource,
  markRefreshing,
  refreshAllSources,
  refreshSource,
} from "@/modules/aspiration-web/refresh-source";
import { buildEdition } from "@/modules/edition/build";
import { editionTestMode } from "@/modules/edition/select";
import { saveSchedule } from "@/modules/edition/settings";
import { getRedacteur } from "@/modules/edition/redacteur";
import { createApifyClient } from "@/modules/social/apify";
import { createDbMediaStore } from "@/modules/social/media-store";
import { collectSocialRuns, launchSocialRuns } from "@/modules/social/refresh-social";
import { addSource } from "@/modules/sources/add-source";
import { refreshSourceImages } from "@/modules/sources/source-image";
import { createPoliteFetcher } from "@/modules/fetching/polite-fetch";
import { setFavorite } from "@/modules/sources/favorite";
import { unsubscribe } from "@/modules/sources/unsubscribe";

export type AddSourceState = {
  status: "idle" | "success" | "error";
  message: string;
  /** What was typed, kept in the field when there is an error. */
  input: string;
};

export async function addSourceAction(_previous: AddSourceState, formData: FormData): Promise<AddSourceState> {
  const input = String(formData.get("url") ?? "");
  const db = await getDb();
  const result = await addSource(db, DEFAULT_USER_ID, input);

  if (!result.ok) return { status: "error", message: result.error, input };

  const { source } = result;
  const firstRelève = isFeedSource(source.type) && source.lastFetchedAt === null;
  if (firstRelève) {
    // The first relève takes a few seconds per article: it runs after the answer, the page updates itself.
    await markRefreshing(db, [source.id]);
    after(() => refreshSource(db, source.id));
  }
  // Its picture for the tile (site logo, profile picture), right away.
  if (!source.imageUrl) {
    after(() => refreshSourceImages(db, { fetchPage: createPoliteFetcher(), mediaStore: createDbMediaStore(db), max: 3 }).catch(() => 0));
  }

  revalidatePath("/", "layout");
  const name = source.displayName;
  if (result.alreadyFollowed) return { status: "success", message: `Vous suivez déjà ${name}.`, input: "" };
  return {
    status: "success",
    message: firstRelève ? `${name} a été ajouté. Relevé des articles en cours…` : `${name} a été ajouté à vos sources.`,
    input: "",
  };
}

export async function refreshAllAction(): Promise<void> {
  const db = await getDb();
  const websites = await db.select({ id: sources.id }).from(sources).where(inArray(sources.type, FEED_SOURCE_TYPES));
  await markRefreshing(
    db,
    websites.map((source) => source.id),
  );
  after(async () => {
    await refreshAllSources(db);
    // Pictures still missing on the Sources page (logo of a site, profile picture…).
    await refreshSourceImages(db, { fetchPage: createPoliteFetcher(), mediaStore: createDbMediaStore(db), max: 30 }).catch(() => 0);
  });
  // Social networks too (button only: the clock does it at 7:30 and 17:30), within the free credit.
  if (process.env.APIFY_TOKEN) {
    const apify = createApifyClient({ token: process.env.APIFY_TOKEN });
    await launchSocialRuns(db, { apify, force: true }).catch(() => null);
    after(() => waitForSocialRuns(db, apify));
  }
  revalidatePath("/", "layout");
}

/** After the button: collects the social answers as they come back (a minute or two), for up to 4 minutes. */
async function waitForSocialRuns(db: Awaited<ReturnType<typeof getDb>>, apify: ReturnType<typeof createApifyClient>) {
  const mediaStore = createDbMediaStore(db);
  for (let round = 0; round < 24; round++) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
    await collectSocialRuns(db, { apify, mediaStore }).catch(() => null);
    const left = await db.select({ id: socialRuns.id }).from(socialRuns).where(eq(socialRuns.status, "running"));
    if (left.length === 0) return;
  }
}

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const sourceId = Number(formData.get("sourceId"));
  if (!Number.isInteger(sourceId)) return;

  await unsubscribe(await getDb(), DEFAULT_USER_ID, sourceId);
  revalidatePath("/", "layout");
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const sourceId = Number(formData.get("sourceId"));
  if (!Number.isInteger(sourceId)) return;

  await setFavorite(await getDb(), DEFAULT_USER_ID, sourceId, formData.get("favorite") === "true");
  revalidatePath("/", "layout");
}

// One preparation at a time; it runs after the answer (several minutes with a local AI).
const editionJob = globalThis as unknown as { plombEditionBuilding?: boolean };

export async function isPreparingEdition(): Promise<boolean> {
  return editionJob.plombEditionBuilding === true;
}

export async function prepareEditionAction(): Promise<void> {
  if (editionJob.plombEditionBuilding) return;
  editionJob.plombEditionBuilding = true;
  const db = await getDb();
  after(async () => {
    try {
      await buildEdition(db, DEFAULT_USER_ID, { redacteur: getRedacteur(), testMode: editionTestMode() });
    } catch (error) {
      console.error("Edition failed", error);
    } finally {
      editionJob.plombEditionBuilding = false;
    }
  });
  revalidatePath("/", "layout");
}

export async function saveScheduleAction(formData: FormData): Promise<void> {
  const frequency = String(formData.get("frequency"));
  const weekdays = formData.getAll("weekdays").map(Number);
  if (frequency !== "daily" && frequency !== "every3days" && frequency !== "weekdays") return;

  await saveSchedule(await getDb(), DEFAULT_USER_ID, { frequency, weekdays });
  revalidatePath("/journal");
}

"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import { sources } from "@/db/schema";
import { markRefreshing, refreshAllSources, refreshSource } from "@/modules/aspiration-web/refresh-source";
import { completeGalleries } from "@/modules/depeches/complete-galleries";
import { addSource } from "@/modules/sources/add-source";
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
  const firstRelève = source.type === "web" && source.lastFetchedAt === null;
  if (firstRelève) {
    // The first relève takes a few seconds per article: it runs after the answer, the page updates itself.
    await markRefreshing(db, [source.id]);
    after(() => refreshSource(db, source.id));
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
  const websites = await db.select({ id: sources.id }).from(sources).where(eq(sources.type, "web"));
  await markRefreshing(
    db,
    websites.map((source) => source.id),
  );
  after(() => refreshAllSources(db));
  revalidatePath("/", "layout");
}

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const sourceId = Number(formData.get("sourceId"));
  if (!Number.isInteger(sourceId)) return;

  await unsubscribe(await getDb(), DEFAULT_USER_ID, sourceId);
  revalidatePath("/", "layout");
}

// Temporary (brick `depeches`): fill the galleries of articles stored before galleries existed.
const galleryJob = globalThis as unknown as { plombGalleriesRunning?: boolean };

export async function isCompletingGalleries(): Promise<boolean> {
  return galleryJob.plombGalleriesRunning === true;
}

export async function completeGalleriesAction(): Promise<void> {
  if (galleryJob.plombGalleriesRunning) return;
  galleryJob.plombGalleriesRunning = true;
  const db = await getDb();
  after(async () => {
    try {
      await completeGalleries(db);
    } finally {
      galleryJob.plombGalleriesRunning = false;
    }
  });
  revalidatePath("/", "layout");
}

export async function toggleFavoriteAction(formData: FormData): Promise<void> {
  const sourceId = Number(formData.get("sourceId"));
  if (!Number.isInteger(sourceId)) return;

  await setFavorite(await getDb(), DEFAULT_USER_ID, sourceId, formData.get("favorite") === "true");
  revalidatePath("/", "layout");
}

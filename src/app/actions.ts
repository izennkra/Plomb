"use server";

import { revalidatePath } from "next/cache";
import { DEFAULT_USER_ID } from "@/db/client";
import { getDb } from "@/db";
import { addSource } from "@/modules/sources/add-source";

export type AddSourceState = {
  status: "idle" | "success" | "error";
  message: string;
  /** What was typed, kept in the field when there is an error. */
  input: string;
};

export async function addSourceAction(_previous: AddSourceState, formData: FormData): Promise<AddSourceState> {
  const input = String(formData.get("url") ?? "");
  const result = await addSource(await getDb(), DEFAULT_USER_ID, input);

  if (!result.ok) return { status: "error", message: result.error, input };

  revalidatePath("/");
  const name = result.source.displayName;
  return result.alreadyFollowed
    ? { status: "success", message: `Vous suivez déjà ${name}.`, input: "" }
    : { status: "success", message: `${name} a été ajouté à vos sources.`, input: "" };
}

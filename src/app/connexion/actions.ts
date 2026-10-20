"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { constantTimeEqual, SESSION_COOKIE, SESSION_MAX_AGE_S, sessionToken } from "@/modules/auth/session";

export type SignInState = { error: string };

export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const password = process.env.PLOMB_PASSWORD;
  if (!password) redirect("/");

  const typed = String(formData.get("password") ?? "");
  if (!constantTimeEqual(typed, password)) return { error: "Mot de passe incorrect." };

  (await cookies()).set(SESSION_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_S,
    path: "/",
  });
  // Only go back to a page of Plomb itself.
  const next = String(formData.get("suite") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

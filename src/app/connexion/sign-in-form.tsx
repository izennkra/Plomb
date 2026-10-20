"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "./actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, { error: "" });
  return (
    <form action={action} className="sign-in">
      <input type="hidden" name="suite" value={next} />
      <label htmlFor="password">Mot de passe</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
      <button type="submit" disabled={pending}>
        {pending ? "Vérification…" : "Entrer"}
      </button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}

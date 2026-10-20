"use client";

import { useActionState } from "react";
import { addSourceAction, type AddSourceState } from "../actions";

const initialState: AddSourceState = { status: "idle", message: "", input: "" };

export function AddSourceForm() {
  const [state, formAction, pending] = useActionState(addSourceAction, initialState);

  return (
    <form action={formAction}>
      <label htmlFor="url">Coller une URL</label>
      <div>
        <input
          id="url"
          name="url"
          type="text"
          placeholder="instagram.com/mouthwash.studio"
          autoComplete="off"
          required
          // The form is reset after each submit: keep the typed URL when it must be corrected.
          defaultValue={state.input}
        />
        <button type="submit" disabled={pending}>
          {pending ? "Vérification…" : "Ajouter"}
        </button>
      </div>
      {state.status !== "idle" && (
        <p role={state.status === "error" ? "alert" : "status"} data-status={state.status}>
          {state.message}
        </p>
      )}
    </form>
  );
}

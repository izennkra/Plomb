"use client";

import { useActionState, useEffect, useRef } from "react";
import { addSourceAction, type AddSourceState } from "../actions";

const initialState: AddSourceState = { status: "idle", message: "", input: "" };

/** The "+" tile once opened: paste a link, Entrée adds the source, Échap closes. */
export function AddSourceForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(addSourceAction, initialState);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="add-source">
      <label htmlFor="url" className="visually-hidden">
        Lien d&apos;un site, d&apos;une chaîne YouTube, d&apos;un compte Instagram, X ou LinkedIn
      </label>
      <input
        ref={input}
        id="url"
        name="url"
        type="text"
        placeholder="Colle un lien"
        autoComplete="off"
        required
        disabled={pending}
        // The form is reset after each submit: keep the typed address when it must be corrected.
        defaultValue={state.input}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
      />
      <button type="submit" disabled={pending}>
        {pending ? "…" : "Ajouter"}
      </button>
      {state.status !== "idle" && (
        <p className="add-source__message" role={state.status === "error" ? "alert" : "status"} data-status={state.status}>
          {state.message}
        </p>
      )}
    </form>
  );
}

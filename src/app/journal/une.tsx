"use client";

import { useState, type ReactNode } from "react";

/** The orange Une: its headline and edition number; a click unfolds its article in place. */
export function Une({ title, badge, details }: { title: string; badge: string; details?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="une" data-open={open}>
      {details ? (
        <button type="button" className="une__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <h2 className="une__title">{title}</h2>
        </button>
      ) : (
        <h2 className="une__title">{title}</h2>
      )}
      {details && (
        <div className="une__details" hidden={!open}>
          {details}
        </div>
      )}
      <p className="une__badge">{badge}</p>
    </article>
  );
}

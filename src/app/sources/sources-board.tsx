"use client";

import Link from "next/link";
import { useState } from "react";
import type { Source } from "@/db/schema";
import { refreshAllAction, toggleFavoriteAction, unsubscribeAction } from "../actions";
import { AddSourceForm } from "./add-source-form";

export type SourceTile = {
  id: number;
  name: string;
  type: Source["type"];
  url: string;
  imageUrl: string | null;
  favorite: boolean;
  status: string;
  error: boolean;
};

const BADGES: Record<Source["type"], string> = { web: "Media", youtube: "Ytb", instagram: "Inst", x: "X.com", linkedin: "In" };

/** "@studio.koto" → "SK", "itsnicethat.com" → "IT": shown when a source has no picture. */
function initials(name: string): string {
  const words = name
    .replace(/^@/, "")
    .replace(/\.(com|org|net|studio|co|fr|io)(\/.*)?$/, "")
    .split(/[\s._\-/]+/)
    .filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** The band of tiles: one per source, "+" to add one. A click on a tile opens its panel underneath. */
export function SourcesBoard({ tiles, refreshing }: { tiles: SourceTile[]; refreshing: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [adding, setAdding] = useState(tiles.length === 0);
  const [confirming, setConfirming] = useState(false);
  const source = tiles.find((tile) => tile.id === selected);

  return (
    <div className="board">
      <ul className="tiles" aria-label="Mes sources">
        {tiles.map((tile) => (
          <li key={tile.id}>
            <button
              type="button"
              className="tile"
              aria-pressed={tile.id === selected}
              aria-label={`${tile.name}${tile.error ? " (en erreur)" : ""}`}
              title={tile.name}
              onClick={() => {
                setSelected(tile.id === selected ? null : tile.id);
                setConfirming(false);
              }}
            >
              {tile.imageUrl ? (
                // Pictures are copied into Plomb (/media/…): plain image.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tile.imageUrl} alt="" loading="lazy" />
              ) : (
                <span className="tile__initials">{initials(tile.name)}</span>
              )}
              <span className="tile__badge">{BADGES[tile.type]}</span>
              {tile.favorite && <span className="tile__star" aria-hidden="true">★</span>}
              {tile.error && <span className="tile__error" aria-hidden="true" />}
            </button>
          </li>
        ))}
        <li className={adding ? "tiles__add tiles__add--open" : "tiles__add"}>
          {adding ? (
            <AddSourceForm onClose={() => setAdding(false)} />
          ) : (
            <button type="button" className="tile tile--plus" aria-label="Ajouter une source" onClick={() => setAdding(true)}>
              +
            </button>
          )}
        </li>
      </ul>

      {source && (
        <section className="source-panel" aria-label={source.name}>
          <a className="source-panel__name" href={source.url} target="_blank" rel="noreferrer noopener">
            {source.name} ↗
          </a>
          <p className="source-panel__status" data-error={source.error}>
            {source.status}
          </p>
          <div className="source-panel__actions">
            <form action={toggleFavoriteAction}>
              <input type="hidden" name="sourceId" value={source.id} />
              <input type="hidden" name="favorite" value={String(!source.favorite)} />
              <button type="submit" aria-pressed={source.favorite}>
                {source.favorite ? "★ Favorite" : "☆ Mettre en favori"}
              </button>
            </form>
            <Link className="button" href={`/depeches?source=${source.id}`}>
              Voir ses dépêches
            </Link>
            {confirming ? (
              <form action={unsubscribeAction} onSubmit={() => setSelected(null)}>
                <input type="hidden" name="sourceId" value={source.id} />
                <button type="submit" className="button--danger">
                  Confirmer le retrait
                </button>
              </form>
            ) : (
              <button type="button" onClick={() => setConfirming(true)}>
                Retirer
              </button>
            )}
          </div>
        </section>
      )}

      <form action={refreshAllAction} className="board__refresh">
        <button type="submit" className="chip" disabled={refreshing || tiles.length === 0}>
          {refreshing ? "Relevé en cours…" : "Relever maintenant"}
        </button>
      </form>
    </div>
  );
}

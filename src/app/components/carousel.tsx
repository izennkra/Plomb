"use client";

import { useState, type KeyboardEvent } from "react";

/** Images of an article, one at a time, with arrows (mouse) and ← → keys (keyboard). */
export function Carousel({ images, title }: { images: string[]; title: string }) {
  const [broken, setBroken] = useState<string[]>([]);
  const visible = images.filter((image) => !broken.includes(image));
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(visible.length - 1, 0));

  if (visible.length === 0) return <div className="carousel carousel--empty" aria-hidden="true" />;

  const go = (step: number) => setIndex((current + step + visible.length) % visible.length);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") go(-1);
    if (event.key === "ArrowRight") go(1);
  };

  return (
    <div
      className="carousel"
      role="region"
      aria-roledescription="carrousel"
      aria-label={`Images : ${title}`}
      tabIndex={visible.length > 1 ? 0 : -1}
      onKeyDown={onKeyDown}
    >
      {/* Images stay on the media's own site (hotlinked); no referrer so sites don't block them. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={visible[current]}
        src={visible[current]}
        alt={`${title} — image ${current + 1} sur ${visible.length}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken((list) => [...list, visible[current]])}
      />
      {visible.length > 1 && (
        <>
          <button type="button" className="carousel__arrow carousel__arrow--prev" onClick={() => go(-1)} aria-label="Image précédente">
            ‹
          </button>
          <button type="button" className="carousel__arrow carousel__arrow--next" onClick={() => go(1)} aria-label="Image suivante">
            ›
          </button>
          <span className="carousel__count" aria-live="polite">
            {current + 1} / {visible.length}
          </span>
        </>
      )}
    </div>
  );
}

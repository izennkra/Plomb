"use client";

import { useRef, useState, type KeyboardEvent } from "react";

/**
 * Images of an article, one at a time, with arrows (mouse) and ← → keys (keyboard).
 * Clicking the image shows it in large (Échap to close).
 */
export function Carousel({ images, title }: { images: string[]; title: string }) {
  const [broken, setBroken] = useState<string[]>([]);
  const visible = images.filter((image) => !broken.includes(image));
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const current = Math.min(index, Math.max(visible.length - 1, 0));

  // No usable picture (none given, or every one failed to load): the card shows its text only.
  if (visible.length === 0) return null;

  const many = visible.length > 1;
  const go = (step: number) => setIndex((current + step + visible.length) % visible.length);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") go(-1);
    if (event.key === "ArrowRight") go(1);
  };
  const alt = `${title} — image ${current + 1} sur ${visible.length}`;

  const arrows = many && (
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
  );

  return (
    <div
      className="carousel"
      role="region"
      aria-roledescription="carrousel"
      aria-label={`Images : ${title}`}
      tabIndex={many ? 0 : -1}
      onKeyDown={onKeyDown}
    >
      <button type="button" className="carousel__open" onClick={() => dialog.current?.showModal()} aria-label="Voir l'image en grand">
        {/* Images stay on the media's own site (hotlinked); no referrer so sites don't block them. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={visible[current]}
          src={visible[current]}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken((list) => [...list, visible[current]])}
        />
      </button>
      {arrows}

      <dialog
        ref={dialog}
        className="lightbox"
        aria-label={`Images : ${title}`}
        onKeyDown={(event) => {
          // Handled here only: the card underneath must not move a second time.
          event.stopPropagation();
          onKeyDown(event);
        }}
        onClick={(event) => {
          // A click on the dark background (not on the image or a button) closes it.
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={visible[current]} alt={alt} referrerPolicy="no-referrer" />
        {arrows}
        <button type="button" className="lightbox__close" onClick={() => dialog.current?.close()} aria-label="Fermer">
          ×
        </button>
      </dialog>
    </div>
  );
}

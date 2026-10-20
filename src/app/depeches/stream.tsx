"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The column of dispatches: scrolling stops on each card, the card in the middle is sharp, its neighbours fade.
 * Keyboard: ↑ ↓ previous / next card, ← → its images, Entrée opens it.
 */
export function Stream({ children, discovered }: { children: ReactNode; discovered: number[] }) {
  const cards = Children.toArray(children);
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lastVisit, setLastVisit] = useState<number | null>(null);

  // "Nouveau" on what arrived since the previous visit (remembered by this browser only).
  useEffect(() => {
    try {
      const previous = Number(localStorage.getItem("plomb:last-visit")) || null;
      setLastVisit(previous);
      localStorage.setItem("plomb:last-visit", String(Date.now()));
    } catch {
      // Private browsing: no marker, nothing else changes.
    }
  }, []);

  // The card crossing the middle line of the column is the active one.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root, rootMargin: "-50% 0px -50% 0px" },
    );
    root.querySelectorAll<HTMLElement>(".stream__item").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [cards.length]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const items = () => root.querySelectorAll<HTMLElement>(".stream__item");
    const go = (index: number) =>
      items()[Math.max(0, Math.min(index, cards.length - 1))]?.scrollIntoView({ block: "center", behavior: "smooth" });

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest("input, textarea, select, dialog")) return;
      const card = items()[active];
      if (event.key === "ArrowDown" || event.key === "j") go(active + 1);
      else if (event.key === "ArrowUp" || event.key === "k") go(active - 1);
      else if (event.key === "ArrowRight") card?.querySelector<HTMLButtonElement>(".carousel__arrow--next")?.click();
      else if (event.key === "ArrowLeft") card?.querySelector<HTMLButtonElement>(".carousel__arrow--prev")?.click();
      else if (event.key === "Enter" && !target.closest("a, button")) card?.querySelector<HTMLAnchorElement>(".card__more")?.click();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, cards.length]);

  return (
    <>
      <p className="stream__count" aria-live="polite">
        {active + 1} / {cards.length}
      </p>
      <div className="stream" ref={scroller}>
        {cards.map((card, index) => (
          <div
            key={index}
            className="stream__item"
            data-index={index}
            data-distance={Math.min(Math.abs(index - active), 2)}
            onClickCapture={
              index === active
                ? undefined
                : (event) => {
                    // A click on a faded card brings it to the middle instead of opening it.
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
                  }
            }
          >
            {lastVisit !== null && discovered[index] > lastVisit && <span className="stream__new">Nouveau</span>}
            {card}
          </div>
        ))}
      </div>
    </>
  );
}

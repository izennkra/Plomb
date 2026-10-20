"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Height of one grid row, in pixels: windows take as many rows as their height needs. */
const ROW = 4;

/**
 * The journal's grid: each window keeps its columns and rises as high as it can, like a newspaper page.
 * Its height is measured to know how many rows it covers (and again when it changes: an image loads, the Une opens).
 */
export function JournalGrid({ children }: { children: ReactNode }) {
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const items = [...element.children] as HTMLElement[];
    const fit = (item: HTMLElement) => {
      const content = item.firstElementChild as HTMLElement | null;
      if (!content) return;
      const gap = parseFloat(getComputedStyle(element).getPropertyValue("--gap")) || 8;
      item.style.gridRowEnd = `span ${Math.ceil((content.getBoundingClientRect().height + gap) / ROW)}`;
    };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) fit(entry.target.parentElement as HTMLElement);
    });
    items.forEach((item) => {
      fit(item);
      if (item.firstElementChild) observer.observe(item.firstElementChild);
    });
    element.dataset.ready = "true";
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="journal-grid" ref={grid}>
      {children}
    </div>
  );
}

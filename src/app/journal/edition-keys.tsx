"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** ← older edition, → newer edition. */
export function EditionKeys({ older, newer }: { older?: string; newer?: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest("input, textarea, select, dialog, .carousel")) return;
      if (event.key === "ArrowLeft" && older) router.push(older);
      if (event.key === "ArrowRight" && newer) router.push(newer);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [older, newer, router]);
  return null;
}

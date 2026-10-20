"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const TABS = [
  { href: "/journal", label: "Journal" },
  { href: "/depeches", label: "Dépêches" },
  { href: "/sources", label: "Sources" },
];

/** The three tabs at the bottom of the screen. The black block slides to the open tab; keys 1, 2, 3 switch tabs. */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const active = TABS.findIndex((tab) => pathname.startsWith(tab.href));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || event.altKey || target.closest("input, textarea, select, [contenteditable]")) return;
      const tab = TABS[Number(event.key) - 1];
      if (tab) router.push(tab.href);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  // Nothing to switch to before signing in.
  if (pathname.startsWith("/connexion")) return null;

  return (
    <nav className="tab-bar" aria-label="Navigation principale" style={{ "--active": active } as React.CSSProperties}>
      {active >= 0 && <span className="tab-bar__active" aria-hidden="true" />}
      {TABS.map((tab, index) => (
        <Link key={tab.href} href={tab.href} className="tab-bar__tab" aria-current={index === active ? "page" : undefined}>
          {tab.label}
          <kbd>{index + 1}</kbd>
        </Link>
      ))}
    </nav>
  );
}

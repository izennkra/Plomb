import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plomb",
  description: "Le journal de veille créative",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="site-header">
          <Link href="/" className="site-name">
            Plomb
          </Link>
          <nav aria-label="Navigation principale">
            <Link href="/">Dépêches</Link>
            <Link href="/sources">Sources</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

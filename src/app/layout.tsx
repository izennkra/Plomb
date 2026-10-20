import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Logo } from "./components/logo";
import { TabBar } from "./components/tab-bar";
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
          <Logo />
        </header>
        {children}
        <TabBar />
      </body>
    </html>
  );
}

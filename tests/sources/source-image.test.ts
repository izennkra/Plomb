import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sources } from "@/db/schema";
import { createDbMediaStore } from "@/modules/social/media-store";
import { avatarFromItems, findSiteIcon, refreshSourceImages, unavatarUrl } from "@/modules/sources/source-image";
import { fixture, fixtureMeta } from "../helpers/fixtures";
import { createTestDb } from "../helpers/test-db";

const social = (name: string) => JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "social", `${name}.json`), "utf8"));

describe("findSiteIcon", () => {
  it("takes the largest square logo of a real site (home-screen icon or large icon)", () => {
    expect(findSiteIcon(fixture("brandnew", "list.html"), fixtureMeta("brandnew").listUrl)).toBe(
      "https://www.underconsideration.com/brandnew/wp/wp-content/themes/make/_favicon/apple-touch-icon.png",
    );
    expect(findSiteIcon(fixture("dandad-work", "list.html"), "https://www.dandad.org/work")).toBe("https://www.dandad.org/favicon-512x512.png");
  });

  it("takes the largest icon, never an SVG, else the sharing image", () => {
    const html = `<link rel="icon" href="/logo.svg"><link rel="icon" sizes="32x32" href="/32.png"><link rel="icon" sizes="192x192" href="/192.png">`;
    expect(findSiteIcon(html, "https://a.com/blog")).toBe("https://a.com/192.png");
    expect(findSiteIcon(`<meta property="og:image" content="/share.jpg">`, "https://a.com/")).toBe("https://a.com/share.jpg");
    expect(findSiteIcon(`<link rel="icon" href="/logo.svg">`, "https://a.com/")).toBeNull();
  });
});

describe("social pictures", () => {
  it("X: the profile picture in large, LinkedIn: the page's logo", () => {
    expect(avatarFromItems({ type: "x" }, social("x"))).toMatch(/^https:\/\/pbs\.twimg\.com\/profile_images\/.+_400x400\.jpg$/);
    expect(avatarFromItems({ type: "linkedin" }, social("linkedin"))).toMatch(/^https:\/\/media\.licdn\.com\//);
  });

  it("X through unavatar.io; Instagram has none there (paid plan): initials instead", () => {
    expect(unavatarUrl({ type: "x", key: "x:helloHEX" })).toBe("https://unavatar.io/x/helloHEX?fallback=false");
    expect(unavatarUrl({ type: "instagram", key: "instagram:studiokoto" })).toBeNull();
  });
});

describe("refreshSourceImages", () => {
  it("copies the site's icon into Plomb, and does not look again for a while when there is none", async () => {
    const db = await createTestDb();
    const [site, empty] = await db
      .insert(sources)
      .values([
        { type: "web", displayName: "a.com", url: "https://a.com/blog", key: "web:a.com/blog" },
        { type: "web", displayName: "b.com", url: "https://b.com/", key: "web:b.com" },
      ])
      .returning();
    const pages: Record<string, string> = {
      "https://a.com": `<link rel="apple-touch-icon" href="/touch.png">`,
      "https://b.com/": `<p>nothing</p>`,
    };
    const fetchPage = async (url: string) => ({ ok: true as const, url, status: 200, contentType: "text/html", body: pages[url] ?? "" });
    const fetchImage = async () => ({ bytes: new Uint8Array([1, 2]), contentType: "image/png" });
    const now = new Date("2026-10-21T10:00:00Z");

    expect(await refreshSourceImages(db, { fetchPage, mediaStore: createDbMediaStore(db), fetchImage, now })).toBe(1);
    const [a, b] = await db.select().from(sources);
    expect(a.id).toBe(site.id);
    expect(a.imageUrl).toMatch(/^\/media\/[0-9a-f]{40}\.png$/);
    expect(b.id).toBe(empty.id);
    expect(b.imageUrl).toBeNull();
    expect(b.imageCheckedAt).toEqual(now);

    // The next call does not look again.
    expect(await refreshSourceImages(db, { fetchPage, mediaStore: createDbMediaStore(db), fetchImage, now })).toBe(0);
  });
});

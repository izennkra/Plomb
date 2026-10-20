import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Source } from "@/db/schema";
import { instagram, linkedin, platformOf, titleFrom, x } from "@/modules/social/platforms";

const load = (name: string) => JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "social", `${name}.json`), "utf8"));
const source = (type: Source["type"], key: string, url: string, displayName: string) =>
  ({ id: 1, type, key, url, displayName }) as Source;

const mouthwash = source("instagram", "instagram:mouthwash.studio", "https://www.instagram.com/mouthwash.studio", "@mouthwash.studio");
const bakers = source("x", "x:studiobakers", "https://x.com/studiobakers", "@studiobakers");
const pentagram = source("linkedin", "linkedin:company/pentagram", "https://www.linkedin.com/company/pentagram", "pentagram");

describe("Instagram (real answer, @mouthwash.studio)", () => {
  const posts = instagram.read(load("instagram"), mouthwash);

  it("reads every post with all the carousel images", () => {
    expect(posts).toHaveLength(3);
    expect(posts[0]).toMatchObject({
      url: "https://www.instagram.com/p/Da0rxX6ICdM",
      title: expect.stringMatching(/^A love story built to last for @bonnieclyde/),
      publishedAt: new Date("2026-07-15T18:13:56.000Z"),
    });
    expect(posts[0].images.length).toBe(12); // 14 slides, 12 kept (carousel limit)
    expect(posts[0].imageUrl).toBe(posts[0].images[0]);
    expect(posts[0].content).toMatch(/bonnieclyde/);
  });

  it("asks only for posts newer than the last relève (3 posts the first time)", () => {
    expect(instagram.input(mouthwash, null)).toEqual({ username: ["mouthwash.studio"], resultsLimit: 3, skipPinnedPosts: true });
    expect(instagram.input(mouthwash, new Date("2026-10-20T05:30:00Z"))).toMatchObject({
      resultsLimit: 10,
      onlyPostsNewerThan: "2026-10-20T05:30:00.000Z",
    });
  });
});

describe("X (real answer, @studiobakers)", () => {
  const posts = x.read(load("x"), bakers);

  it("reads own tweets with their images, at most 10", () => {
    expect(posts.length).toBeLessThanOrEqual(10);
    expect(posts[0]).toMatchObject({
      url: "https://x.com/studiobakers/status/2112473899858313453",
      title: "website explorations",
      publishedAt: new Date("2026-10-20T09:20:00Z"),
    });
    expect(posts[0].images).toHaveLength(4);
    expect(posts[0].excerpt).not.toMatch(/t\.co/);
  });

  it("leaves out retweets and replies", () => {
    const items = [
      { url: "https://x.com/a/status/1", text: "mine", createdAt: "Tue Oct 20 09:20:00 +0000 2026" },
      { url: "https://x.com/a/status/2", text: "rt", retweeted_tweet: { id: "9" } },
      { url: "https://x.com/a/status/3", text: "reply", isReply: true },
    ];
    expect(x.read(items, bakers).map((post) => post.title)).toEqual(["mine"]);
  });
});

describe("LinkedIn (real answer, Pentagram)", () => {
  const posts = linkedin.read(load("linkedin"), pentagram);

  it("reads the page's posts with text, date and images", () => {
    expect(posts).toHaveLength(3);
    expect(posts[0]).toMatchObject({
      url: expect.stringMatching(/^https:\/\/www\.linkedin\.com\/posts\/pentagram_/),
      title: expect.stringMatching(/^MTA Arts & Design has been bringing art/),
      publishedAt: new Date("2026-10-12T21:24:54.317Z"),
    });
    expect(posts[1].images.length).toBeGreaterThan(1);
  });

  it("uses the profile scraper for people", () => {
    const person = source("linkedin", "linkedin:in/jane-doe", "https://www.linkedin.com/in/jane-doe", "jane-doe");
    expect(platformOf(person)?.actor).toBe("harvestapi/linkedin-profile-posts");
    expect(platformOf(pentagram)?.actor).toBe("harvestapi/linkedin-company-posts");
  });
});

describe("titleFrom", () => {
  it("takes the first real line, without links or a line of hashtags", () => {
    expect(titleFrom("#branding #design\nA new identity for Nourish.\nMore…", "x")).toBe("A new identity for Nourish.");
    expect(titleFrom("https://t.co/abc", "Nouveau post de @x")).toBe("Nouveau post de @x");
  });
});

import { describe, expect, it } from "vitest";
import { createPoliteFetcher } from "@/modules/fetching/polite-fetch";
import type { FetchResult } from "@/modules/fetching/safe-fetch";

const page = (url: string, body = "ok", status = 200): FetchResult => ({
  ok: true,
  url,
  status,
  contentType: "text/html",
  body,
});

/** A fake network: robots.txt per site + a log of every requested URL. */
function fakeNetwork(robots: Record<string, string | null>) {
  const requested: string[] = [];
  const fetch = async (url: string): Promise<FetchResult> => {
    requested.push(url);
    const { origin, pathname } = new URL(url);
    if (pathname === "/robots.txt") {
      const txt = robots[origin];
      return txt === null || txt === undefined ? page(url, "not found", 404) : page(url, txt);
    }
    return page(url);
  };
  return { fetch, requested };
}

/** A fake clock: sleeping just moves time forward. */
function fakeClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
    sleeps,
  };
}

describe("politeFetcher", () => {
  it("refuses a page forbidden by robots.txt, without requesting it", async () => {
    const network = fakeNetwork({ "https://a.com": "User-agent: *\nDisallow: /private/" });
    const fetchPage = createPoliteFetcher({ fetch: network.fetch, ...fakeClock() });

    const result = await fetchPage("https://a.com/private/page");

    expect(result).toMatchObject({ ok: false, reason: "robots", error: expect.stringMatching(/interdit/) });
    expect(network.requested).toEqual(["https://a.com/robots.txt"]);
  });

  it("allows everything when robots.txt is missing", async () => {
    const network = fakeNetwork({ "https://a.com": null });
    const fetchPage = createPoliteFetcher({ fetch: network.fetch, ...fakeClock() });

    expect(await fetchPage("https://a.com/anything")).toMatchObject({ ok: true });
  });

  it("reads robots.txt only once per site", async () => {
    const network = fakeNetwork({ "https://a.com": "User-agent: *\nAllow: /" });
    const fetchPage = createPoliteFetcher({ fetch: network.fetch, ...fakeClock() });

    await fetchPage("https://a.com/1");
    await fetchPage("https://a.com/2");

    expect(network.requested.filter((url) => url.endsWith("/robots.txt"))).toHaveLength(1);
  });

  it("waits at least 1 second between two requests to the same site", async () => {
    const network = fakeNetwork({ "https://a.com": "" });
    const clock = fakeClock();
    const fetchPage = createPoliteFetcher({ fetch: network.fetch, ...clock });

    await fetchPage("https://a.com/1");
    await fetchPage("https://a.com/2");

    // robots.txt, /1, /2 → two waits of 1 s
    expect(clock.sleeps).toEqual([1000, 1000]);
  });

  it("does not wait because of another site", async () => {
    const network = fakeNetwork({ "https://a.com": "", "https://b.com": "" });
    const clock = fakeClock();
    const fetchPage = createPoliteFetcher({ fetch: network.fetch, ...clock });

    await fetchPage("https://a.com/robots-free");
    clock.sleeps.length = 0;
    await fetchPage("https://b.com/1");

    // Only b.com's own robots.txt → /1 wait, nothing inherited from a.com.
    expect(clock.sleeps).toEqual([1000]);
  });

  it("respects a longer Crawl-delay, capped at 10 seconds", async () => {
    const network = fakeNetwork({
      "https://slow.com": "User-agent: *\nCrawl-delay: 3",
      "https://greedy.com": "User-agent: *\nCrawl-delay: 60",
    });
    const clock = fakeClock();
    const fetchPage = createPoliteFetcher({ fetch: network.fetch, ...clock });

    await fetchPage("https://slow.com/1");
    await fetchPage("https://greedy.com/1");

    expect(clock.sleeps).toEqual([3000, 10000]);
  });
});

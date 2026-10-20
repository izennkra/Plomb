import robotsParser from "robots-parser";
import { safeFetch, type FetchResult } from "./safe-fetch";

export type PoliteResult = FetchResult | { ok: false; reason: "robots"; error: string };

export type PageFetcher = (
  url: string,
  options?: {
    /**
     * A feed the reader subscribed to (YouTube channel…): read like a feed reader does, without the robots.txt rules
     * meant for crawlers — the polite pace still applies. Decided by Izenn (2026-10-20).
     */
    feedReader?: boolean;
  },
) => Promise<PoliteResult>;

/** Name used to match robots.txt rules. */
const ROBOT_NAME = "PlombBot";
const MIN_DELAY_MS = 1_000;
const MAX_DELAY_MS = 10_000;

type Robots = ReturnType<typeof robotsParser> | null;

/**
 * Creates a fetcher that behaves like a polite visitor: it follows each site's robots.txt
 * and waits between two requests to the same site. Create one per relève.
 */
export function createPoliteFetcher({
  fetch = (url: string) => safeFetch(url),
  now = () => Date.now(),
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}: {
  fetch?: (url: string) => Promise<FetchResult>;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
} = {}): PageFetcher {
  const robotsByOrigin = new Map<string, Promise<Robots>>();
  const lastRequestAt = new Map<string, number>();

  async function throttled(url: string, delayMs: number): Promise<FetchResult> {
    const { origin } = new URL(url);
    const current = now();
    const last = lastRequestAt.get(origin);
    const slot = last === undefined ? current : Math.max(current, last + delayMs);
    // The slot is booked before waiting: requests to the same site made at the same time (two sources of one site)
    // queue up one after the other instead of leaving together.
    lastRequestAt.set(origin, slot);
    if (slot > current) await sleep(slot - current);
    return fetch(url);
  }

  function robotsFor(origin: string): Promise<Robots> {
    let robots = robotsByOrigin.get(origin);
    if (!robots) {
      const robotsUrl = `${origin}/robots.txt`;
      robots = throttled(robotsUrl, MIN_DELAY_MS).then((response) =>
        response.ok && response.status === 200 ? robotsParser(robotsUrl, response.body) : null,
      );
      robotsByOrigin.set(origin, robots);
    }
    return robots;
  }

  return async (url, { feedReader = false } = {}) => {
    const { origin } = new URL(url);
    if (feedReader) return throttled(url, MIN_DELAY_MS);
    const robots = await robotsFor(origin);
    if (robots?.isDisallowed(url, ROBOT_NAME)) {
      return { ok: false, reason: "robots", error: "Ce site interdit aux robots l'accès à cette page." };
    }
    const crawlDelay = (robots?.getCrawlDelay(ROBOT_NAME) ?? 0) * 1000;
    return throttled(url, Math.min(Math.max(MIN_DELAY_MS, crawlDelay), MAX_DELAY_MS));
  };
}

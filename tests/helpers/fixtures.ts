import { readFileSync } from "node:fs";
import { join } from "node:path";

export type SiteName =
  | "the-brandidentity"
  | "itsnicethat"
  | "brandnew"
  | "dandad"
  | "dandad-insights"
  | "dandad-work"
  | "findings"
  | "offbrand";

const dir = (site: SiteName) => join(__dirname, "..", "fixtures", "sites", site);

/** Copy of a real site captured by `npm run fixtures:capture`. */
export function fixture(site: SiteName, file: "list.html" | "article.html" | "feed.xml"): string {
  return readFileSync(join(dir(site), file), "utf8");
}

export function fixtureMeta(site: SiteName): { listUrl: string; articleUrl?: string; feedUrl?: string } {
  return JSON.parse(readFileSync(join(dir(site), "meta.json"), "utf8"));
}

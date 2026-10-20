// Saves copies of the test sites in tests/fixtures/sites/ so tests don't depend on the internet.
// Usage: npm run fixtures:capture   (re-run when a site changes its layout)
import { mkdir, writeFile } from "node:fs/promises";

const SITES = {
  "the-brandidentity": { list: "https://the-brandidentity.com/features", article: /\/project\/[^"'#?]+/ },
  itsnicethat: { list: "https://www.itsnicethat.com/", article: /\/articles\/[^"'#?]+/ },
  brandnew: { list: "https://www.underconsideration.com/brandnew/", article: /\/brandnew\/archives\/[\w-]+\.php/ },
  dandad: { list: "https://www.dandad.org/work/d-ad-awards-archive", article: /\/work\/d-ad-awards-archive\/[^"'#?]+/ },
  findings: { list: "https://findings.mouthwash.studio/", feed: "https://findings.mouthwash.studio/feed" },
  offbrand: { list: "https://offbrandkoto.substack.com/", feed: "https://offbrandkoto.substack.com/feed" },
};

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};

async function get(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return { url: response.url, body: await response.text() };
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 1000));

for (const [name, site] of Object.entries(SITES)) {
  const dir = new URL(`../tests/fixtures/sites/${name}/`, import.meta.url);
  await mkdir(dir, { recursive: true });
  const meta = { capturedAt: new Date().toISOString().slice(0, 10) };

  const list = await get(site.list);
  await writeFile(new URL("list.html", dir), list.body);
  meta.listUrl = list.url;

  if (site.article) {
    const path = list.body.match(site.article)?.[0];
    if (!path) throw new Error(`${name}: no article link found`);
    await pause();
    const article = await get(new URL(path, list.url).toString());
    await writeFile(new URL("article.html", dir), article.body);
    meta.articleUrl = article.url;
  }
  if (site.feed) {
    await pause();
    const feed = await get(site.feed);
    await writeFile(new URL("feed.xml", dir), feed.body);
    meta.feedUrl = feed.url;
  }

  await writeFile(new URL("meta.json", dir), JSON.stringify(meta, null, 2) + "\n");
  console.log(`✓ ${name}`, meta);
  await pause();
}

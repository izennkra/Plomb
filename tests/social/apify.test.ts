import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApifyClient, isFinished } from "@/modules/social/apify";
import { startTestServer, type TestServer } from "../helpers/test-server";

let server: TestServer;
const seen: { method?: string; url?: string; auth?: string; body: string }[] = [];

beforeAll(async () => {
  server = await startTestServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
      const json = (status: number, data: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(data));
      if (req.url === "/acts/apify~instagram-post-scraper/runs") return json(201, { data: { id: "run1", defaultDatasetId: "ds1" } });
      if (req.url === "/actor-runs/run1") return json(200, { data: { status: "SUCCEEDED", defaultDatasetId: "ds1" } });
      if (req.url?.startsWith("/datasets/ds1/items")) return json(200, [{ url: "https://www.instagram.com/p/x/" }]);
      if (req.url === "/users/me/limits") return json(200, { data: { current: { monthlyUsageUsd: 1.23 } } });
      if (req.url === "/acts/broke~actor/runs") return json(402, { error: { message: "Monthly usage hard limit exceeded" } });
      return json(404, {});
    });
  });
});

afterAll(() => server.close());

const client = () => createApifyClient({ token: "apify_api_test", baseUrl: server.base });

describe("Apify client", () => {
  it("starts a run, follows it and reads its results", async () => {
    expect(await client().startRun("apify/instagram-post-scraper", { username: ["mouthwash.studio"] })).toEqual({ runId: "run1", datasetId: "ds1" });
    expect(seen[0]).toMatchObject({ method: "POST", auth: "Bearer apify_api_test", body: JSON.stringify({ username: ["mouthwash.studio"] }) });
    expect(await client().getRun("run1")).toEqual({ status: "SUCCEEDED", datasetId: "ds1" });
    expect(await client().getItems("ds1")).toEqual([{ url: "https://www.instagram.com/p/x/" }]);
  });

  it("reads what was spent this month", async () => {
    expect(await client().monthlyUsageUsd()).toBe(1.23);
  });

  it("says clearly when the free credit is used up", async () => {
    await expect(client().startRun("broke/actor", {})).rejects.toThrow(/Crédit gratuit Apify épuisé/);
  });

  it("knows when a run is finished", () => {
    expect(isFinished("RUNNING")).toBe(false);
    expect(isFinished("SUCCEEDED")).toBe(true);
    expect(isFinished("FAILED")).toBe(true);
  });

  it("refuses to start without a token", () => {
    expect(() => createApifyClient({ token: "" })).toThrow(/Jeton Apify manquant/);
  });
});

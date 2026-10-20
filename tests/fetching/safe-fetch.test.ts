import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { safeFetch, type Lookup } from "@/modules/fetching/safe-fetch";
import { startTestServer, type TestServer } from "../helpers/test-server";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer((req, res) => {
    switch (req.url) {
      case "/page":
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end("<h1>Café</h1>");
        return;
      case "/redirect":
        res.writeHead(302, { location: "/page" }).end();
        return;
      case "/loop":
        res.writeHead(302, { location: "/loop" }).end();
        return;
      case "/to-internal":
        res.writeHead(302, { location: "http://internal.example/secret" }).end();
        return;
      case "/big":
        res.writeHead(200).end("x".repeat(2_000));
        return;
      case "/slow":
        return;
      default:
        res.writeHead(404).end("not found");
    }
  });
});

afterAll(() => server.close());

/** Pretends every host name resolves to the given address. */
const resolvesTo = (address: string): Lookup => async () => [{ address, family: address.includes(":") ? 6 : 4 }];

describe("safeFetch (local test server, internal addresses allowed)", () => {
  const options = { allowInternal: true };

  it("returns the page and its text", async () => {
    const result = await safeFetch(`${server.base}/page`, options);
    expect(result).toMatchObject({ ok: true, status: 200, url: `${server.base}/page`, body: "<h1>Café</h1>" });
    expect(result.ok && result.contentType).toBe("text/html; charset=utf-8");
  });

  it("follows redirects and returns the final address", async () => {
    expect(await safeFetch(`${server.base}/redirect`, options)).toMatchObject({ ok: true, url: `${server.base}/page` });
  });

  it("returns error statuses as responses (the caller decides)", async () => {
    expect(await safeFetch(`${server.base}/missing`, options)).toMatchObject({ ok: true, status: 404 });
  });

  it("stops after too many redirects", async () => {
    expect(await safeFetch(`${server.base}/loop`, options)).toMatchObject({ ok: false, reason: "too-many-redirects" });
  });

  it("refuses a response that is too large", async () => {
    expect(await safeFetch(`${server.base}/big`, { ...options, maxBytes: 1_000 })).toMatchObject({
      ok: false,
      reason: "too-large",
    });
  });

  it("gives up on a site that takes too long", async () => {
    expect(await safeFetch(`${server.base}/slow`, { ...options, timeoutMs: 200 })).toMatchObject({
      ok: false,
      reason: "timeout",
      error: expect.stringMatching(/ne répond pas/),
    });
  });

  it("can skip reading the body", async () => {
    expect(await safeFetch(`${server.base}/page`, { ...options, readBody: false })).toMatchObject({ ok: true, body: "" });
  });
});

describe("safeFetch — internal addresses blocked (default)", () => {
  it.each(["http://127.0.0.1/", "http://localhost/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data", "http://[::1]/"])(
    "refuses %s",
    async (url) => {
      expect(await safeFetch(url)).toMatchObject({ ok: false, reason: "blocked", error: expect.stringMatching(/interne/) });
    },
  );

  it("refuses a public name that resolves to an internal address", async () => {
    expect(await safeFetch("http://sneaky.example/", { lookup: resolvesTo("10.0.0.7") })).toMatchObject({
      ok: false,
      reason: "blocked",
    });
  });

  it("refuses a redirect towards an internal address", async () => {
    // Only the local test server itself is allowed; the redirect target resolves to a private address.
    const result = await safeFetch(`${server.base}/to-internal`, {
      lookup: resolvesTo("192.168.0.10"),
      allowInternal: (host) => host === "127.0.0.1",
    });
    expect(result).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("refuses non-http protocols", async () => {
    expect(await safeFetch("file:///etc/passwd")).toMatchObject({ ok: false, reason: "invalid" });
  });
});

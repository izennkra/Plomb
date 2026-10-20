import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkWebsite } from "@/modules/sources/check-website";

/** The test server runs on this computer: allow it explicitly. */
const local = { allowInternal: true };

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    switch (req.url) {
      case "/ok":
        res.writeHead(200, { "content-type": "text/html" }).end("<h1>Hello</h1>");
        return;
      case "/old":
        res.writeHead(301, { location: "/new" }).end();
        return;
      case "/new":
        res.writeHead(200).end("moved");
        return;
      case "/protected":
        res.writeHead(403).end();
        return;
      case "/missing":
        res.writeHead(404).end();
        return;
      case "/broken":
        res.writeHead(500).end();
        return;
      case "/slow":
        return; // never answers
      default:
        res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe("checkWebsite", () => {
  it("accepts a site that answers", async () => {
    expect(await checkWebsite(`${base}/ok`, local)).toEqual({ ok: true, finalUrl: `${base}/ok` });
  });

  it("follows redirects and returns the final address", async () => {
    expect(await checkWebsite(`${base}/old`, local)).toEqual({ ok: true, finalUrl: `${base}/new` });
  });

  it("accepts a site that exists but blocks robots (403)", async () => {
    expect(await checkWebsite(`${base}/protected`, local)).toEqual({ ok: true, finalUrl: `${base}/protected` });
  });

  it("refuses a page that does not exist (404)", async () => {
    const result = await checkWebsite(`${base}/missing`, local);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/n'existe pas.*404/) });
  });

  it("refuses a site in error (500)", async () => {
    const result = await checkWebsite(`${base}/broken`, local);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/erreur.*500/) });
  });

  it("refuses a site that takes too long", async () => {
    const result = await checkWebsite(`${base}/slow`, { ...local, timeoutMs: 200 });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/ne répond pas/) });
  });

  it("refuses a site that cannot be reached", async () => {
    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, "127.0.0.1", resolve));
    const { port } = closed.address() as AddressInfo;
    await new Promise((resolve) => closed.close(resolve));

    const result = await checkWebsite(`http://127.0.0.1:${port}/`, local);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/Impossible de joindre/) });
  });

  it("refuses an internal address", async () => {
    const result = await checkWebsite("http://192.168.1.1/");
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/adresses internes/) });
  });
});

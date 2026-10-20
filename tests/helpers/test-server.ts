import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export type TestServer = { base: string; close: () => Promise<void> };

/** Starts a local HTTP server on a random port. */
export async function startTestServer(handler: RequestListener): Promise<TestServer> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

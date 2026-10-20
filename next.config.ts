import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database driver with native binaries: loaded by Node, not bundled.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;

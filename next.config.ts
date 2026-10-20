import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database driver with native binaries: loaded by Node, not bundled.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // Online, the database updates (drizzle/) must travel with the app: they are applied at start.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
};

export default nextConfig;

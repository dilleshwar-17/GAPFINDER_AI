import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack to this project so a lockfile in a parent directory is not
  // treated as the workspace root.
  turbopack: { root: path.resolve(".") },
  // The app is entirely server-rendered with no remote image optimisation.
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["unpdf"],
  experimental: {
    // PDF text extraction can take longer than the default server action limit.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;

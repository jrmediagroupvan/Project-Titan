import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["occt-import-js"],
  outputFileTracingIncludes: {
    "/api/uploads/[id]/preview": ["./node_modules/occt-import-js/dist/**/*"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb"
    }
  }
};

export default nextConfig;

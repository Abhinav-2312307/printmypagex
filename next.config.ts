import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow up to 50 MB uploads plus multipart overhead before we compress/store them.
    proxyClientMaxBodySize: "60mb"
  }
};

export default nextConfig;

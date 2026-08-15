import type { NextConfig } from "next";

const nextConfig: any = {
  experimental: {
    // Allow up to 50 MB uploads plus multipart overhead before we compress/store them.
    proxyClientMaxBodySize: "60mb"
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  }
};

export default nextConfig;

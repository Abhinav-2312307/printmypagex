import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep a little multipart overhead above Cloudinary's 10 MB free-plan file cap.
    proxyClientMaxBodySize: "12mb"
  }
};

export default nextConfig;

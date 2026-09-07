import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // workspace packages are consumed from src/ (just-in-time); Next transpiles them
  transpilePackages: ["@swiss-now/core", "@swiss-now/motion"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        // the forked basemap style is versioned by content; cache it for a day at the CDN
        source: "/map/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" }],
      },
    ];
  },
};

export default nextConfig;

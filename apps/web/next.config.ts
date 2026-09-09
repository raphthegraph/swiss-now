import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // workspace packages are consumed from src/ (just-in-time); Next transpiles them
  transpilePackages: ["@swiss-now/core", "@swiss-now/motion", "@swiss-now/story-video"],
  poweredByHeader: false,
  // the generated rail files (≈ 20 k JSON files) are read at runtime by name; never trace them into
  // the function bundles — on Vercel they move to Blob (docs/FREE_TIER_ARCHITECTURE.md)
  outputFileTracingExcludes: {
    "/api/rail/active-paths": ["./public/rail/**"],
    "/api/state/rail": ["./public/rail/**"],
    "/": ["./public/rail/**"],
    "/status": ["./public/rail/**"],
  },
  // small static data read from disk by route handlers (until DATA_BASE_URL points at Blob):
  // the vote files and the municipality register used by the events geocoder
  outputFileTracingIncludes: {
    "/api/state/politics": ["./public/data/politics/**"],
    "/api/state/events": ["./public/geo/municipalities-2026.json"],
    "/api/snapshot": ["./public/data/politics/**", "./public/geo/municipalities-2026.json"],
    "/api/story/today": ["./public/data/politics/**"],
    "/place/[key]": ["./public/data/**", "./public/geo/municipalities-2026.json"],
  },
  async headers() {
    return [
      {
        // the forked basemap style is versioned by content; cache it for a day at the CDN
        source: "/map/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" }],
      },
      {
        // boundaries and the municipality register change once a year (vintage in the file name)
        source: "/geo/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, s-maxage=604800" }],
      },
      {
        // rail files are immutable per GTFS build (rebuilt Mon/Thu); paths are fetched per train
        source: "/rail/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400" }],
      },
    ];
  },
};

export default nextConfig;

import { createHash } from "node:crypto";
import { WEATHER_TTL_SECONDS, cacheControl, getWeatherState } from "@/lib/state/weather";

export const runtime = "nodejs";

/**
 * GET /api/state/weather → WeatherState (docs/ARCHITECTURE.md §5).
 * Cached at the CDN for the source cadence, served stale while revalidating for 5× that.
 */
export async function GET(request: Request) {
  try {
    const state = await getWeatherState();
    const body = JSON.stringify(state);
    const etag = `"${createHash("sha1").update(body).digest("hex").slice(0, 16)}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": cacheControl(WEATHER_TTL_SECONDS) },
      });
    }
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": cacheControl(WEATHER_TTL_SECONDS),
        ETag: etag,
        "X-Swiss-Now-Observed-At": state.observedAt,
        "X-Swiss-Now-Freshness": state.freshness,
      },
    });
  } catch (error) {
    // No last-good copy exists yet at this stage (Phase 0); report the outage honestly and briefly.
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        schemaVersion: 1,
        freshness: "outage",
        error: message,
        updatedAt: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "public, s-maxage=30", "X-Swiss-Now-Freshness": "outage" },
      },
    );
  }
}

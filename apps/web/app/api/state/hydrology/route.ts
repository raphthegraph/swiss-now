import { createHash } from "node:crypto";
import { cacheControl } from "@/lib/state/weather";
import { HYDROLOGY_TTL_SECONDS, getHydrologyState } from "@/lib/state/hydrology";

export const runtime = "nodejs";

/** GET /api/state/hydrology → HydrologyState (BAFU levels, discharge, temperature, danger levels). */
export async function GET(request: Request) {
  try {
    const state = await getHydrologyState();
    const { updatedAt: _ignored, ...stable } = state;
    const etag = `"${createHash("sha1").update(JSON.stringify(stable)).digest("hex").slice(0, 16)}"`;
    const headers = {
      "Cache-Control": cacheControl(HYDROLOGY_TTL_SECONDS),
      ETag: etag,
      "X-Swiss-Now-Observed-At": state.observedAt,
      "X-Swiss-Now-Freshness": state.freshness,
    };
    if (request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers });
    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
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

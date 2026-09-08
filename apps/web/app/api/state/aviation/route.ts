import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AVIATION_TTL_SECONDS, aviationAccess, getAviationState } from "@/lib/state/aviation";
import { cacheControl } from "@/lib/state/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** AviationState — 451 while the only source (adsb.fi) is blocked by the licence policy. */
export async function GET(req: Request) {
  if (aviationAccess() === "blocked")
    return NextResponse.json(
      {
        schemaVersion: 1,
        freshness: "outage",
        error: "aviation is gated: adsb.fi allows personal use only (docs/IA.md §7)",
        updatedAt: new Date().toISOString(),
      },
      { status: 451, headers: { "Cache-Control": "public, s-maxage=3600" } },
    );
  try {
    const state = await getAviationState();
    const { updatedAt: _u, ...stable } = state;
    const etag = `"${createHash("sha1").update(JSON.stringify(stable)).digest("hex").slice(0, 16)}"`;
    const headers = {
      "Cache-Control": cacheControl(AVIATION_TTL_SECONDS),
      ETag: etag,
      "X-Swiss-Now-Freshness": state.freshness,
    };
    if (req.headers.get("if-none-match") === etag)
      return new NextResponse(null, { status: 304, headers });
    return NextResponse.json(state, { headers });
  } catch (e) {
    return NextResponse.json(
      {
        schemaVersion: 1,
        freshness: "outage",
        error: e instanceof Error ? e.message : String(e),
        updatedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "public, s-maxage=30" } },
    );
  }
}

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { ENERGY_TTL_SECONDS, getEnergyState } from "@/lib/state/energy";
import { cacheControl } from "@/lib/state/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** EnergyState: Swissgrid border flows and frequency, Energy-Charts mix and price. */
export async function GET(req: Request) {
  try {
    const state = await getEnergyState();
    const { updatedAt: _u, ...stable } = state;
    const etag = `"${createHash("sha1").update(JSON.stringify(stable)).digest("hex").slice(0, 16)}"`;
    const headers = {
      "Cache-Control": cacheControl(ENERGY_TTL_SECONDS),
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

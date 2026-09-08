import { NextResponse } from "next/server";
import { getRegionGeoJson } from "@/lib/state/hazards";

export const runtime = "nodejs";

/** Region polygons (WGS84 GeoJSON) for the fire-danger and avalanche layers. */
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (kind !== "fire" && kind !== "avalanche") return new NextResponse("unknown", { status: 404 });
  try {
    const geojson = await getRegionGeoJson(kind);
    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=21600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

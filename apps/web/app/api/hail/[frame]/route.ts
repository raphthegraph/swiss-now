import { NextResponse } from "next/server";
import { warpToMercatorPng, type ColorRamp } from "@swiss-now/core/data-sources/meteoswiss/radar";
import { getHailGrid } from "@/lib/state/hazards";

export const runtime = "nodejs";

/** MESHS in mm → orange to deep red with alpha; nothing below 20 mm (the product's first class). */
const hailRamp: ColorRamp = (v) => {
  if (!Number.isFinite(v) || v < 20) return [0, 0, 0, 0];
  const t = Math.min(1, (v - 20) / 40);
  return [
    Math.round(224 - 60 * t),
    Math.round(116 - 90 * t),
    Math.round(45 - 25 * t),
    Math.round(150 + 90 * t),
  ];
};

/** One hail frame as a Web Mercator PNG on the radar plate. */
export async function GET(_req: Request, ctx: { params: Promise<{ frame: string }> }) {
  const { frame } = await ctx.params;
  if (!/^[a-z0-9_.]+\.h5$/i.test(frame)) return new NextResponse("bad id", { status: 400 });
  const grid = await getHailGrid(frame);
  if (!grid) return new NextResponse("unknown frame", { status: 404 });
  try {
    const img = warpToMercatorPng(grid, hailRamp);
    return new NextResponse(new Uint8Array(img.png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}

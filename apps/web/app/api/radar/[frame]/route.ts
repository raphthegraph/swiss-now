import { getRadarGrid, gridToPng } from "@/lib/state/radar";

export const runtime = "nodejs";

/**
 * GET /api/radar/{assetId} → Web-Mercator RGBA PNG of one MeteoSwiss RZC composite.
 * Assets are immutable, so the response is cached at the CDN for a day; decoding happens once
 * per frame (≈ 30–60 ms after the lookup table is warm).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ frame: string }> }) {
  const { frame } = await params;
  let grid;
  try {
    grid = await getRadarGrid(frame);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "public, s-maxage=30" } },
    );
  }
  if (!grid) return new Response("unknown radar frame", { status: 404 });
  const png = gridToPng(grid);
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
      "X-Swiss-Now-Valid-At": grid.endTime,
    },
  });
}

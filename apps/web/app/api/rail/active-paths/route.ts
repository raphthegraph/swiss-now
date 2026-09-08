import { getRailState, RAIL_TTL_SECONDS, readRailJson } from "@/lib/state/rail";
import { cacheControl } from "@/lib/state/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pathCache = new Map<string, number[][] | null>();

/**
 * GET /api/rail/active-paths → one bundle with the route paths of every train running now, so a
 * new session draws trains after a single request instead of ~800 individual fetches.
 * Paths are immutable per GTFS build; the set changes with the active trips (60 s).
 */
export async function GET() {
  const state = await getRailState();
  const ids = [...new Set(state.activeTrips.map((t) => t.pathId))].sort();
  const paths: Record<string, number[][]> = {};
  await Promise.all(
    ids.map(async (id) => {
      if (!/^[0-9a-f]{6,16}$/.test(id)) return;
      let coords = pathCache.get(id);
      if (coords === undefined) {
        try {
          const name = ["paths", `${id}.json`].join("/");
          const f = await readRailJson<{ geometry: { coordinates: number[][] } }>(name);
          coords = f.geometry.coordinates;
        } catch {
          coords = null;
        }
        pathCache.set(id, coords);
      }
      if (coords) paths[id] = coords;
    }),
  );
  return Response.json(
    { gtfsBuild: state.gtfsBuild, count: Object.keys(paths).length, paths },
    { headers: { "Cache-Control": cacheControl(RAIL_TTL_SECONDS) } },
  );
}

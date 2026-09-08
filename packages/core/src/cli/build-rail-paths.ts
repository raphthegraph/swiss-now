#!/usr/bin/env tsx
/**
 * Mode 2 job: pattern stop sequences → route paths on the SBB rail network.
 * Usage: tsx src/cli/build-rail-paths.ts --rail <dir with patterns.json + stops.json> [--lines <geojson>]
 * Writes <dir>/paths/{patternId}.json (GeoJSON LineString) and <dir>/distances.json.
 * SBB "Linie (graphisch)" export: 3 147 LineStrings, 510 k vertices, terms-by incl. commercial.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LonLat } from "../state/common";
import { haversineMeters } from "../data-sources/transit/geo-lite";
import {
  buildPatternPath,
  buildRailGraph,
  simplifyPath,
  type RailDayFile,
  type RailPatternsFile,
  type RailStopsFile,
} from "../data-sources/transit/index";
import { BAV_XTF_URL, readBavSegments } from "../data-sources/transit/bav-xtf";

/** Simplification tolerance: invisible below zoom 12 (≈ 38 m/px), keeps paths around 2 KB. */
const SIMPLIFY_METERS = 20;

const SBB_LINES_URL =
  "https://data.sbb.ch/api/explore/v2.1/catalog/datasets/linie-mit-polygon/exports/geojson?limit=-1";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

interface LinesGeoJSON {
  features: Array<{ geometry: { type: string; coordinates: unknown } }>;
}

async function loadLines(path: string): Promise<LonLat[][]> {
  if (!existsSync(path)) {
    console.log(`[build-rail-paths] downloading SBB lines → ${path}`);
    const res = await fetch(SBB_LINES_URL, {
      headers: { "User-Agent": "SwissNow/0.0.1 (+https://github.com/raphthegraph/swiss-now)" },
    });
    if (!res.ok) throw new Error(`SBB lines ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const gj = JSON.parse(readFileSync(path, "utf8")) as LinesGeoJSON;
  const lines: LonLat[][] = [];
  for (const f of gj.features) {
    if (f.geometry.type === "LineString") lines.push(f.geometry.coordinates as LonLat[]);
    else if (f.geometry.type === "MultiLineString")
      for (const l of f.geometry.coordinates as LonLat[][]) lines.push(l);
  }
  return lines;
}

/** Running distance to vertex i along coords (cached per call site via closure-free recompute; paths are short). */
const cumCache = new WeakMap<LonLat[], number[]>();
function cumulative(coords: LonLat[], i: number): number {
  let c = cumCache.get(coords);
  if (!c) {
    c = [0];
    for (let k = 1; k < coords.length; k++)
      c.push(c[k - 1]! + haversineMeters(coords[k - 1]!, coords[k]!));
    cumCache.set(coords, c);
  }
  return c[i] ?? 0;
}

const main = async () => {
  const dir = arg("rail", join(process.cwd(), "out", "rail"));
  const linesPath = arg("lines", join(dir, "sbb-lines.geojson"));
  /** `both` (default) merges the SBB lines with the BAV national network; `sbb` or `bav` alone for diagnosis. */
  const network = arg("network", "both");
  const bavPath = arg("bav", join(dir, "schienennetz_2056_de.xtf"));
  const t0 = Date.now();
  const log = (m: string) =>
    console.log(`[build-rail-paths] ${m} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

  const patterns = JSON.parse(readFileSync(join(dir, "patterns.json"), "utf8")) as RailPatternsFile;
  const stops = JSON.parse(readFileSync(join(dir, "stops.json"), "utf8")) as RailStopsFile;
  let lines: LonLat[][] = [];
  if (network === "bav" || network === "both") {
    if (!existsSync(bavPath)) {
      log(`downloading BAV network → ${bavPath}`);
      const res = await fetch(BAV_XTF_URL, {
        headers: { "User-Agent": "SwissNow/0.0.1 (+https://github.com/raphthegraph/swiss-now)" },
      });
      if (!res.ok) throw new Error(`BAV xtf ${res.status}`);
      writeFileSync(bavPath, Buffer.from(await res.arrayBuffer()));
    }
    const segments = await readBavSegments(bavPath);
    lines.push(...segments.map((s) => s.coordinates));
    log(`BAV network: ${segments.length} segments`);
  }
  if (network === "sbb" || network === "both") {
    const sbb = await loadLines(linesPath);
    lines.push(...sbb);
    log(`SBB lines: ${sbb.length}`);
  }
  const graph = buildRailGraph(lines);
  log(`graph: ${graph.nodes.length} nodes from ${lines.length} lines (${network})`);

  mkdirSync(join(dir, "paths"), { recursive: true });
  // only patterns that appear in the service-day files; one path per unique stop sequence
  const used = new Set<string>();
  const daysDir = join(dir, "days");
  if (existsSync(daysDir)) {
    for (const f of readdirSync(daysDir)) {
      const day = JSON.parse(readFileSync(join(daysDir, f), "utf8")) as RailDayFile;
      for (const t of day.trips) used.add(t[1]);
    }
  }
  const wanted = used.size ? [...used] : Object.keys(patterns);
  log(`patterns to path: ${wanted.length} of ${Object.keys(patterns).length}`);
  const cache = new Map<string, number[] | undefined>();
  const pathIdBySeq = new Map<string, string>();
  const distances: Record<string, { path: string; d: number[]; straight: number; length: number }> =
    {};
  let n = 0;
  let straightLegs = 0;
  let totalLegs = 0;
  let vertices = 0;
  for (const pid of wanted) {
    const entry = patterns[pid];
    if (!entry) continue;
    const stopIds = entry[1];
    const seqKey = stopIds.join(",");
    const existing = pathIdBySeq.get(seqKey);
    if (existing && distances[existing]) {
      distances[pid] = { ...distances[existing]!, path: existing };
      continue;
    }
    const coords: LonLat[] = [];
    for (const id of stopIds) {
      const s = stops[id];
      if (!s) break;
      coords.push([s[0], s[1]]);
    }
    if (coords.length !== stopIds.length || coords.length < 2) continue;
    const pathId = createHash("sha1").update(seqKey).digest("hex").slice(0, 12);
    const path = buildPatternPath(graph, pathId, coords, cache);
    // indices of stop vertices in the full path, so simplification keeps them
    const stopIdx: number[] = [];
    let ci = 0;
    for (const d of path.stopDistances) {
      while (ci < path.coordinates.length - 1 && cumulative(path.coordinates, ci) < d - 0.5) ci++;
      stopIdx.push(ci);
    }
    const simplified = simplifyPath(path.coordinates, SIMPLIFY_METERS, stopIdx);
    vertices += simplified.length;
    const straight = path.legKinds.filter((k) => k === "straight").length;
    straightLegs += straight;
    totalLegs += path.legKinds.length;
    distances[pid] = {
      path: pathId,
      d: path.stopDistances.map((v) => Math.round(v)),
      straight,
      length: Math.round(path.lengthMeters),
    };
    pathIdBySeq.set(seqKey, pid);
    writeFileSync(
      join(dir, "paths", `${pathId}.json`),
      JSON.stringify({
        type: "Feature",
        properties: {
          pathId,
          legKinds: path.legKinds,
          lengthMeters: Math.round(path.lengthMeters),
        },
        geometry: {
          type: "LineString",
          coordinates: simplified.map(([x, y]: LonLat) => [
            Math.round(x * 1e5) / 1e5,
            Math.round(y * 1e5) / 1e5,
          ]),
        },
      }),
    );
    n++;
    if (n % 1000 === 0) log(`paths: ${n}`);
  }
  log(`avg vertices per path: ${Math.round(vertices / Math.max(1, n))}`);
  writeFileSync(join(dir, "distances.json"), JSON.stringify(distances));
  log(
    `done: ${n} paths, ${straightLegs}/${totalLegs} legs fell back to straight lines (${((100 * straightLegs) / Math.max(1, totalLegs)).toFixed(1)} %)`,
  );
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * The SFOE/ElCom register of electricity production plants (CSV in LV95) folded to the plants the
 * map shows (1 MW and more), with WASTA names for hydro plants and the 220/380 kV grid lines from
 * the ESTI dataset simplified for the web. All three are opendata.swiss terms_by.
 */
import proj4 from "proj4";
import { parse } from "csv-parse/sync";
import type { LonLat } from "../../state/common";
import type { GridLineProps, PowerPlant, PowerPlantType } from "../../state/energy-sites";

const LV95 =
  "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs";
export const toWgs84 = (x: number, y: number): LonLat => {
  const [lon, lat] = proj4(LV95, "WGS84", [x, y]) as [number, number];
  return [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
};

interface PlantRow {
  xtf_id: string;
  Address: string;
  PostCode: string;
  Municipality: string;
  Canton: string;
  BeginningOfOperation: string;
  TotalPower: string;
  MainCategory: string;
  SubCategory: string;
  PlantCategory: string;
  _x: string;
  _y: string;
}

/** Register categories → the map's plant types. */
export function plantType(sub: string, plantCat: string): PowerPlantType {
  switch (sub) {
    case "subcat_1":
      if (plantCat === "plantcat_6") return "hydro-pumped";
      if (plantCat === "plantcat_7") return "hydro-storage";
      return "hydro-run";
    case "subcat_2":
      return "solar";
    case "subcat_3":
      return "wind";
    case "subcat_4":
      return "biomass";
    case "subcat_6":
      return "nuclear";
    case "subcat_10":
      return "waste";
    case "subcat_7":
    case "subcat_8":
    case "subcat_9":
      return "gas";
    default:
      return "other";
  }
}

/** Plants of `minKw` and more with coordinates, from the register CSV (UTF-8 with BOM). */
export function parsePlantsCsv(text: string, minKw = 1000): PowerPlant[] {
  const rows = parse(text.replace(/^\uFEFF/, ""), {
    columns: true,
    skip_empty_lines: true,
  }) as PlantRow[];
  const out: PowerPlant[] = [];
  for (const r of rows) {
    const kw = Number(r.TotalPower);
    const x = Number(r._x);
    const y = Number(r._y);
    if (!(kw >= minKw) || !Number.isFinite(x) || !Number.isFinite(y) || !x || !y) continue;
    const plant: PowerPlant = {
      id: r.xtf_id,
      name: r.Municipality,
      municipality: r.Municipality,
      canton: r.Canton,
      type: plantType(r.SubCategory, r.PlantCategory),
      kw: Math.round(kw),
      lonLat: toWgs84(x, y),
    };
    const year = Number(r.BeginningOfOperation?.slice(0, 4));
    if (year > 1800) plant.since = year;
    out.push(plant);
  }
  return out.sort((a, b) => b.kw - a.kw);
}

interface WastaRow {
  WASTANumber: string;
  Name: string;
  Location: string;
  Canton: string;
  _x: string;
  _y: string;
}

/** Gives hydro plants the WASTA name of the nearest hydro plant within `maxMetres`. */
export function joinWastaNames(plants: PowerPlant[], wastaCsv: string, maxMetres = 800): number {
  const rows = parse(wastaCsv.replace(/^\uFEFF/, ""), {
    columns: true,
    skip_empty_lines: true,
  }) as WastaRow[];
  const sites = rows
    .map((r) => ({ name: r.Name, x: Number(r._x), y: Number(r._y) }))
    .filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y) && s.name);
  let joined = 0;
  for (const p of plants) {
    if (!p.type.startsWith("hydro")) continue;
    const [x, y] = proj4("WGS84", LV95, [p.lonLat[0], p.lonLat[1]]) as [number, number];
    let best: { name: string; d: number } | undefined;
    for (const s of sites) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d <= maxMetres && (!best || d < best.d)) best = { name: s.name, d };
    }
    if (best) {
      p.name = best.name;
      joined++;
    }
  }
  return joined;
}

interface WfsFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

/** Minimal GeoJSON shapes (core carries no GeoJSON typings). */
export interface GridLineFeature {
  type: "Feature";
  properties: GridLineProps;
  geometry:
    | { type: "LineString"; coordinates: LonLat[] }
    | { type: "MultiLineString"; coordinates: LonLat[][] };
}
export interface GridFile {
  type: "FeatureCollection";
  features: GridLineFeature[];
}

/** Douglas–Peucker on lon/lat with a tolerance in degrees (≈ 50 m at 0.0005). */
function simplify(points: LonLat[], tol: number): LonLat[] {
  if (points.length < 3) return points;
  const sq = tol * tol;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = points[a]!;
    const [bx, by] = points[b]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy || 1;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = points[k]!;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        idx = k;
      }
    }
    if (maxD > sq && idx > 0) {
      keep[idx] = true;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

/** Keeps the lines in operation at `minKv` and above, simplified and rounded, as GeoJSON. */
export function simplifyGrid(
  wfs: { features: WfsFeature[] },
  minKv = 220,
  tolDeg = 0.0004,
): GridFile {
  const features: GridLineFeature[] = [];
  for (const f of wfs.features) {
    const p = f.properties;
    const kv = Number(
      String(p["spannung"] ?? "")
        .replace(/^S/, "")
        .replace(/kV$/, ""),
    );
    if (!(kv >= minKv) || p["betriebsstatus"] !== "inBetrieb") continue;
    const round = (pts: LonLat[]) =>
      simplify(pts, tolDeg).map(
        ([x, y]) => [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4] as LonLat,
      );
    const props: GridLineProps = { kv };
    if (typeof p["bezeichnung"] === "string") props.name = p["bezeichnung"];
    if (typeof p["eigentuemer"] === "string") props.owner = p["eigentuemer"];
    if (f.geometry.type === "LineString")
      features.push({
        type: "Feature",
        properties: props,
        geometry: { type: "LineString", coordinates: round(f.geometry.coordinates as LonLat[]) },
      });
    else if (f.geometry.type === "MultiLineString")
      features.push({
        type: "Feature",
        properties: props,
        geometry: {
          type: "MultiLineString",
          coordinates: (f.geometry.coordinates as LonLat[][]).map(round),
        },
      });
  }
  return { type: "FeatureCollection", features };
}

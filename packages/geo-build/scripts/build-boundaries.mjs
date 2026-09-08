#!/usr/bin/env node
/**
 * Builds the geo spine from swisstopo swissBOUNDARIES3D (free incl. commercial, "© swisstopo") and
 * the BFS municipality register, in pure JavaScript (no GDAL):
 *   node scripts/build-boundaries.mjs [--vintage 2026] [--out ../../apps/web/public/geo] [--quantile 0.1]
 * Outputs
 *   ch-<vintage>.topo.json        TopoJSON: municipalities (id = BFS number), districts, cantons, lakes
 *   municipalities-<vintage>.json BFS register: bfs number, name, canton code, district; canton table
 * Coordinates: EPSG:2056 → WGS84 with proj4, Z dropped; simplified with Visvalingam (topojson-simplify).
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const require = createRequire(import.meta.url);
const StreamZip = require("node-stream-zip");
const shapefile = require("shapefile");
const proj4 = require("proj4");
const { topology } = require("topojson-server");
const { presimplify, simplify, quantile, filter, filterAttached } = require("topojson-simplify");
const { quantize } = require("topojson-client");

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith("--") ? [a.slice(2), all[i + 1] ?? "true"] : [])).filter((x) => x.length),
);
const vintage = String(args.vintage ?? "2026");
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(args.out ?? join(here, "../../../apps/web/public/geo"));
const q = Number(args.quantile ?? 0.1);
const cacheDir = resolve(here, "../out");
mkdirSync(cacheDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const LV95 =
  "+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs";
const toWgs = proj4(LV95, "EPSG:4326");
const CANTON_BY_NUM = {
  1: "ZH", 2: "BE", 3: "LU", 4: "UR", 5: "SZ", 6: "OW", 7: "NW", 8: "GL", 9: "ZG", 10: "FR", 11: "SO", 12: "BS", 13: "BL",
  14: "SH", 15: "AR", 16: "AI", 17: "SG", 18: "GR", 19: "AG", 20: "TG", 21: "TI", 22: "VD", 23: "VS", 24: "NE", 25: "GE", 26: "JU",
};

const log = (m) => console.log(`[build-boundaries] ${m}`);

async function download(url, file) {
  if (existsSync(file)) return;
  log(`downloading ${url}`);
  const res = await fetch(url, { headers: { "user-agent": "swiss-now-geo-build/1.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

function project(coords) {
  if (typeof coords[0] === "number") {
    const [x, y] = toWgs.forward([coords[0], coords[1]]);
    return [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6];
  }
  return coords.map(project);
}

async function readLayer(zip, layer) {
  const base = `swissBOUNDARIES3D_1_5_TLM_${layer}`;
  const buf = async (ext) => {
    const b = await zip.entryData(`${base}.${ext}`);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };
  const encoding = (await zip.entryData(`${base}.cpg`)).toString().toLowerCase().includes("utf") ? "utf-8" : "latin1";
  const src = await shapefile.open(await buf("shp"), await buf("dbf"), { encoding });
  const features = [];
  for (;;) {
    const r = await src.read();
    if (r.done) break;
    features.push({ type: "Feature", properties: r.value.properties, geometry: { type: r.value.geometry.type, coordinates: project(r.value.geometry.coordinates) } });
  }
  return features;
}

const shpZip = join(cacheDir, `swissboundaries3d_${vintage}-01.shp.zip`);
await download(
  `https://data.geo.admin.ch/ch.swisstopo.swissboundaries3d/swissboundaries3d_${vintage}-01/swissboundaries3d_${vintage}-01_2056_5728.shp.zip`,
  shpZip,
);
const zip = new StreamZip.async({ file: shpZip });
const hoheit = await readLayer(zip, "HOHEITSGEBIET");
const bezirke = await readLayer(zip, "BEZIRKSGEBIET");
const kantone = await readLayer(zip, "KANTONSGEBIET");
await zip.close();

// municipalities: Swiss "Gemeindegebiet" and Kommunanz polygons with a BFS number below 9000;
// lake areas carry BFS numbers ≥ 9000 (and cantonal "Kantonsgebiet" lake objects)
const municipalities = { type: "FeatureCollection", features: [] };
const lakes = { type: "FeatureCollection", features: [] };
for (const f of hoheit) {
  const p = f.properties;
  if (p.ICC !== "CH") continue;
  const canton = CANTON_BY_NUM[p.KANTONSNUM];
  if (p.BFS_NUMMER >= 9000 || p.OBJEKTART === "Kantonsgebiet") {
    lakes.features.push({ type: "Feature", id: p.BFS_NUMMER, properties: { name: p.NAME }, geometry: f.geometry });
    continue;
  }
  municipalities.features.push({
    type: "Feature",
    id: p.BFS_NUMMER,
    properties: { name: p.NAME, canton, district: p.BEZIRKSNUM },
    geometry: f.geometry,
  });
}
const districts = {
  type: "FeatureCollection",
  features: bezirke.map((f) => ({
    type: "Feature",
    id: f.properties.BEZIRKSNUM,
    properties: { name: f.properties.NAME, canton: CANTON_BY_NUM[f.properties.KANTONSNUM] },
    geometry: f.geometry,
  })),
};
const cantons = {
  type: "FeatureCollection",
  features: kantone.map((f) => ({
    type: "Feature",
    id: CANTON_BY_NUM[f.properties.KANTONSNUM],
    properties: { name: f.properties.NAME, num: f.properties.KANTONSNUM },
    geometry: f.geometry,
  })),
};
log(`municipalities ${municipalities.features.length} · districts ${districts.features.length} · cantons ${cantons.features.length} · lakes ${lakes.features.length}`);

// one topology so shared borders are shared arcs; simplify by area (Visvalingam), keep attachment
const quant = Number(args.quantization ?? 1e4);
let topo = topology({ municipalities, districts, cantons, lakes });
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, q));
// simplify keeps the weight as a third coordinate; drop it, then quantize (delta-encoded ints)
topo.arcs = topo.arcs.map((arc) => arc.map(([x, y]) => [x, y]));
topo = quantize(topo, quant);
topo = filter(topo, filterAttached(topo));
topo.properties = {
  vintage: Number(vintage),
  source: "swissBOUNDARIES3D, swisstopo",
  attribution: "© swisstopo",
  crs: "EPSG:4326",
  builtAt: new Date().toISOString(),
};
const topoPath = join(outDir, `ch-${vintage}.topo.json`);
const topoJson = JSON.stringify(topo);
writeFileSync(topoPath, topoJson);
log(`${topoPath}: ${(topoJson.length / 1024).toFixed(0)} KB raw · ${(gzipSync(topoJson).length / 1024).toFixed(0)} KB gz (quantile ${q}, quantization ${quant})`);

// the BFS register: the join spine (bfs number → name, canton, district) as of 1 January of the vintage
const date = `01-01-${vintage}`;
const regFile = join(cacheDir, `communes-${vintage}.csv`);
await download(`https://www.agvchapp.bfs.admin.ch/api/communes/levels?date=${date}`, regFile);
const csv = readFileSync(regFile, "utf8").split(/\r?\n/).filter(Boolean);
const header = csv[0].split(",");
const col = (name) => header.indexOf(name);
const rows = csv.slice(1).map((l) => l.split(","));
const register = {
  vintage: Number(vintage),
  date: `${vintage}-01-01`,
  source: "BFS municipality register (agvchapp)",
  attribution: "Source: BFS",
  cantons: Object.fromEntries(
    cantons.features.map((f) => [f.id, { num: f.properties.num, name: f.properties.name }]),
  ),
  municipalities: rows
    .map((r) => ({
      bfs: Number(r[col("BfsCode")]),
      name: r[col("Name")],
      canton: CANTON_BY_NUM[Number(r[col("CantonId")])],
      district: Number(r[col("DistrictId")]),
      districtName: r[col("District")],
    }))
    .filter((m) => Number.isFinite(m.bfs) && m.canton)
    .sort((a, b) => a.bfs - b.bfs),
};
const regPath = join(outDir, `municipalities-${vintage}.json`);
writeFileSync(regPath, JSON.stringify(register));
log(`${regPath}: ${register.municipalities.length} municipalities`);
const topoIds = new Set(topo.objects.municipalities.geometries.map((g) => g.id));
const missing = register.municipalities.filter((m) => !topoIds.has(m.bfs)).length;
const extra = [...topoIds].filter((id) => !register.municipalities.some((m) => m.bfs === id)).length;
log(`register ↔ topology: ${missing} register entries without polygon, ${extra} polygons without register entry`);

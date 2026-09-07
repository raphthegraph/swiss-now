#!/usr/bin/env node
/**
 * Forks swisstopo's `ch.swisstopo.lightbasemap.vt` into the Swiss Now ground style:
 * near-monochrome, warm paper, muted water, no POI clutter. Tiles, sprites and glyphs
 * keep pointing at swisstopo (free, attribution "© swisstopo").
 *
 * Usage: node scripts/fork-basemap-style.mjs [outFile]
 * First pass of the Phase 0 design sprint — tune by hand after Spike A.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SOURCE_STYLE = "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json";
const OUT = resolve(process.argv[2] ?? "../../apps/web/public/map/swiss-now-light.json");

// tokens (kept in sync with @swiss-now/motion tokens/color.ts by hand — this script has no TS deps)
const PAPER = "#F4F3EF";
const INK = "#111214";
const GRAPHITE = "#5C6068";
const LAKE = "#D9E2EA";
const LAKE_LINE = "#B8C7D3";

const HIDE = new Set([
  "poi_rank1",
  "poi_rank2",
  "aerodrome_label",
  "hazard",
  "road_number",
  "hillshade_yellow",
  "landuse_parking",
  "landuse_parking_outline",
]);
const WATER_FILL = new Set(["water"]);
const WATER_LINE = new Set(["water_line", "water_line_intermittent", "water_outline", "contour_line_blue"]);
const WATER_LABEL = new Set(["waterway_line_label", "water_name_point_label"]);
const COLOR_PROPS = new Set([
  "fill-color",
  "fill-outline-color",
  "line-color",
  "text-color",
  "text-halo-color",
  "background-color",
  "icon-color",
  "icon-halo-color",
  "fill-extrusion-color",
]);

const res = await fetch(SOURCE_STYLE, { headers: { "User-Agent": "SwissNow/0.0.1 style-fork" } });
if (!res.ok) throw new Error(`swisstopo style ${res.status}`);
const style = await res.json();

style.name = "swiss-now-light";
style.metadata = {
  ...(style.metadata ?? {}),
  "swiss-now:forkedFrom": `${style.name === "swiss-now-light" ? "ch.swisstopo.lightbasemap.vt" : style.name}`,
  "swiss-now:forkedAt": new Date().toISOString(),
  "swiss-now:attribution": "© swisstopo",
};

for (const layer of style.layers) {
  if (HIDE.has(layer.id)) {
    layer.layout = { ...(layer.layout ?? {}), visibility: "none" };
    continue;
  }
  if (layer.type === "background") {
    layer.paint = { ...(layer.paint ?? {}), "background-color": PAPER };
    continue;
  }
  if (WATER_FILL.has(layer.id)) {
    layer.paint = { ...(layer.paint ?? {}), "fill-color": LAKE };
    continue;
  }
  if (WATER_LINE.has(layer.id)) {
    layer.paint = { ...(layer.paint ?? {}), "line-color": LAKE_LINE };
    continue;
  }
  if (WATER_LABEL.has(layer.id)) {
    layer.paint = { ...(layer.paint ?? {}), "text-color": "#6F8598", "text-halo-color": PAPER };
    continue;
  }
  if (layer.id.startsWith("hillshade")) {
    const op = layer.paint?.["fill-opacity"];
    layer.paint = { ...(layer.paint ?? {}), "fill-opacity": scaleOpacity(op, 0.55) };
    // hillshade colour becomes a neutral relief tint
    if (layer.paint["fill-color"]) layer.paint["fill-color"] = desaturate(layer.paint["fill-color"], 1);
    continue;
  }
  if (layer.paint) {
    for (const key of Object.keys(layer.paint)) {
      if (COLOR_PROPS.has(key)) layer.paint[key] = desaturate(layer.paint[key], 0.92);
    }
  }
  if (layer.type === "symbol") {
    layer.paint = { ...(layer.paint ?? {}), "text-halo-color": PAPER };
    if (layer.id.startsWith("place_") || layer.id.startsWith("peaks")) {
      layer.paint["text-color"] = layer.id === "place_city" ? INK : GRAPHITE;
    }
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(style, null, 1) + "\n");
console.log(`wrote ${OUT} (${style.layers.length} layers)`);

// ---- helpers --------------------------------------------------------------
function scaleOpacity(value, factor) {
  if (value === undefined) return factor;
  return mapNumbers(value, (n) => Math.round(n * factor * 1000) / 1000);
}
function mapNumbers(value, fn) {
  if (typeof value === "number") return fn(value);
  if (Array.isArray(value)) return value.map((v) => mapNumbers(v, fn));
  if (value && typeof value === "object" && Array.isArray(value.stops)) {
    return { ...value, stops: value.stops.map(([z, v]) => [z, mapNumbers(v, fn)]) };
  }
  return value;
}
/** Recursively desaturates every colour string inside a paint value (plain, stops, or expression). */
function desaturate(value, amount) {
  if (typeof value === "string") return desaturateColor(value, amount);
  if (Array.isArray(value)) return value.map((v) => desaturate(v, amount));
  if (value && typeof value === "object" && Array.isArray(value.stops)) {
    return { ...value, stops: value.stops.map(([z, v]) => [z, desaturate(v, amount)]) };
  }
  return value;
}
function desaturateColor(str, amount) {
  const c = parseColor(str);
  if (!c) return str;
  const [r, g, b, a] = c;
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // pull towards luminance, then tint slightly warm so greys sit on the paper
  const mix = (ch) => Math.round(ch + (l - ch) * amount);
  let [nr, ng, nb] = [mix(r), mix(g), mix(b)];
  nr = Math.min(255, nr + 2);
  nb = Math.max(0, nb - 2);
  return a === 1 ? `#${hex(nr)}${hex(ng)}${hex(nb)}` : `rgba(${nr}, ${ng}, ${nb}, ${a})`;
}
function parseColor(s) {
  s = s.trim();
  let m;
  if ((m = /^#([0-9a-f]{3})$/i.exec(s))) {
    const [r, g, b] = m[1].split("").map((h) => parseInt(h + h, 16));
    return [r, g, b, 1];
  }
  if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s))) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
  }
  if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s))) {
    return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  }
  if ((m = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s))) {
    const [r, g, b] = hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
    return [r, g, b, m[4] === undefined ? 1 : +m[4]];
  }
  return null;
}
function hslToRgb(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}
function hex(n) {
  return n.toString(16).padStart(2, "0");
}

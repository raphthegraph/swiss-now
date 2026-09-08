#!/usr/bin/env node
/**
 * MapLibre GL 6 loads its web worker as an ES module via `import.meta.url`, which bundlers
 * resolve inconsistently (Turbopack resolved it to the page URL → HTML → "non-JavaScript MIME type").
 * We therefore serve the worker and its shared chunk as static files and point `setWorkerUrl` at them.
 * Runs on `predev` / `prebuild` so the copies always match the installed maplibre-gl version.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const dist = join(dirname(pkgPath), "dist");
const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;
const out = join(process.cwd(), "public", "map", "vendor");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(dist, f), join(out, f));
writeFileSync(join(out, "VERSION"), `${version}\n`);
// the geo spine for vote chapters (built by packages/geo-build; gitignored copy)
const geoSrc = join(process.cwd(), "..", "web", "public", "geo", "ch-2026.topo.json");
if (existsSync(geoSrc)) {
  mkdirSync(join(process.cwd(), "public", "geo"), { recursive: true });
  copyFileSync(geoSrc, join(process.cwd(), "public", "geo", "ch-2026.topo.json"));
}
console.log(`copied maplibre-gl ${version} worker + shared chunk → public/map/vendor/ (+ geo spine)`);

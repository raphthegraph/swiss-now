# @swiss-now/geo-build

Build-time geo scripts in pure JavaScript (no GDAL on the build machine). Outputs are committed to `apps/web/public/` and served with long cache headers.

| Script             | Input                                                                 | Output                                                                          |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `fork-style`       | swisstopo `ch.swisstopo.lightbasemap.vt` style                        | `public/map/swiss-now-light.json` (near-monochrome ground on the design tokens) |
| `build-boundaries` | swissBOUNDARIES3D shapefile zip (STAC), BFS municipality register CSV | `public/geo/ch-<vintage>.topo.json`, `public/geo/municipalities-<vintage>.json` |

```bash
pnpm --filter @swiss-now/geo-build build-boundaries -- --vintage 2026   # ≈ 1 min, downloads 36 MB once into out/
pnpm --filter @swiss-now/geo-build test                                  # validates the committed files
```

`build-boundaries` unzips the shapefiles with node-stream-zip, parses them with `shapefile`, reprojects EPSG:2056 → WGS84 with proj4 (Bessel + Helmert parameters), builds one TopoJSON topology so shared borders are shared arcs, simplifies with topojson-simplify (Visvalingam; `--quantile 0.1` keeps the heaviest tenth of the points, ≈ 270 KB gzipped) and quantizes to `--quantization 1e4`. Objects: `municipalities` (id = BFS number, properties name/canton/district), `districts` (id = district number), `cantons` (id = canton code), `lakes` (the cantonal lake areas). Liechtenstein and foreign enclaves are dropped. The register is the join spine for every statistic (bfs → name, canton, district) as of 1 January of the vintage.

Licence: swissBOUNDARIES3D is free including commercial use with the attribution "© swisstopo"; the register is BFS OPEN BY. Vintages change each 1 January (municipality mergers): rebuild with the new year and keep the old file for older statistics.

# @swiss-now/web

The interactive web experience: Next.js 16 App Router, MapLibre GL (Spike A next), deck.gl, Motion/GSAP.

## Routes

| Route                       | What                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                         | Summary strip from live MeteoSwiss data (warmest, coldest, strongest gust, share of stations reporting rain). The full-screen map arrives with Spike A. |
| `/status`                   | Freshness of live layers and the source register (licence, attribution, cadence, commercial use).                                                       |
| `/api/state/weather`        | `WeatherState` JSON. Pull-through cached: Next Data Cache `revalidate=300` + `Cache-Control: s-maxage=300, stale-while-revalidate=1500`, `ETag`.        |
| `/api/meta/sources`         | Source metadata for credits and video end cards.                                                                                                        |
| `/map/vendor/*`             | MapLibre worker + shared chunk, copied on `predev`/`prebuild` (bundlers mis-resolve the worker's `import.meta.url`).                                    |
| `/map/swiss-now-light.json` | Forked swisstopo `lightbasemap.vt` style (regenerate with `pnpm --filter @swiss-now/geo-build fork-style`).                                             |

## Run

```bash
pnpm install
pnpm --filter @swiss-now/web dev
```

## Rail data

The RAIL layer needs two generated inputs (gitignored, rebuilt twice a week by `.github/workflows/gtfs.yml`):

```bash
pnpm --filter @swiss-now/core build-gtfs -- --out apps/web/public/rail --days 7        # downloads the 248 MB GTFS, ≈ 3 min
pnpm --filter @swiss-now/core build-rail-paths -- --rail apps/web/public/rail          # SBB line graph → one path per stop sequence
```

and the free GTFS-RT token in `apps/web/.env.local` as `OTD_API_KEY=…` (register at api-manager.opentransportdata.swiss). Without the token the layer still shows scheduled trains, marked stale.

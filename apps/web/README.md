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

No environment variables are required yet: every Phase 0 source is open and unauthenticated.

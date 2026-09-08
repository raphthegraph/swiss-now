# @swiss-now/web

The interactive web experience: Next.js 16 App Router, MapLibre GL (Spike A next), deck.gl, Motion/GSAP.

## Routes

| Route                                                                               | What                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                                                 | Summary strip from live MeteoSwiss data (warmest, coldest, strongest gust, share of stations reporting rain). The full-screen map arrives with Spike A. |
| `/status`                                                                           | Freshness of live layers and the source register (licence, attribution, cadence, commercial use).                                                       |
| `/api/state/weather`                                                                | `WeatherState` JSON. Pull-through cached: Next Data Cache `revalidate=300` + `Cache-Control: s-maxage=300, stale-while-revalidate=1500`, `ETag`.        |
| `/api/state/seismic`                                                                | `SeismicState`: SED reviewed catalogue, last 30 days, earthquakes only. 2 min.                                                                          |
| `POST /api/snapshot`                                                                | Writes the current 10-minute composite snapshot if missing (visitor-driven on the free tier; a scheduled ping once deployed).                           |
| `/api/snapshots`, `/api/snapshots/{id}`                                             | Snapshot list (48 h) and immutable snapshot files (the story's input; no timeline UI).                                                                  |
| `/api/story/today`                                                                  | `StorySpec` ranked from today's snapshots (also the Remotion input).                                                                                    |
| `/api/state/air`                                                                    | `AirState`: Zürich UGZ hourly (tail of the yearly CSV), Sensor.Community, pollen; index per station. 5 min.                                             |
| `/api/state/hazards`, `/api/hazards/regions/{fire\|avalanche}`, `/api/hail/{frame}` | `HazardsState` plus the region polygons (WGS84) and hail PNGs.                                                                                          |
| `/api/state/energy`                                                                 | `EnergyState`: Swissgrid flows and frequency (1 min), Energy-Charts mix and price (15 min, proxied).                                                    |
| `/api/state/events`                                                                 | `EventsState`: geocoded police and SRF headlines, 24 h window. 5 min.                                                                                   |
| `/api/state/aviation`                                                               | `AviationState` (adsb.fi, reported positions). Answers 451 while the licence policy blocks the source. 10 s.                                            |
| `/api/state/politics`                                                               | `PoliticsState`: latest vote Sunday per municipality, recent votes, upcoming dates; static files from `public/data` or `DATA_BASE_URL`. 1 h.            |
| `/geo/*`, `/data/*`                                                                 | Geo spine (TopoJSON, register), vote files and statistics indicators (`data/stats/index.json` + one file per indicator); long cache headers.            |
| `/today`                                                                            | The web-native story: scroll-driven chapters steering the live map.                                                                                     |
| `/api/meta/sources`                                                                 | Source metadata for credits and video end cards.                                                                                                        |
| `/map/vendor/*`                                                                     | MapLibre worker + shared chunk, copied on `predev`/`prebuild` (bundlers mis-resolve the worker's `import.meta.url`).                                    |
| `/map/swiss-now-light.json`                                                         | Forked swisstopo `lightbasemap.vt` style (regenerate with `pnpm --filter @swiss-now/geo-build fork-style`).                                             |

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

## QA in a painting browser

The in-app and headless browsers used by the assistant cannot render WebGL, so map behaviour is checked with Chromium's software renderer:

```bash
node scripts/qa-rail-hover.mjs            # switches to RAIL, hovers a drawn train, expects the hover card; screenshot in /tmp/sn/qa-rail.png
```

It needs a cached Playwright Chromium (`~/Library/Caches/ms-playwright/chromium-*`) and the server on port 3100.

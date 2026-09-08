# Swiss Now

A living, near-real-time map of Switzerland. Official Swiss open data is normalized into one state model that drives two renderers: an interactive web map and a Remotion video, "Switzerland Today".

Status: deployed on Vercel (free tier) at https://swiss-now.vercel.app with fifteen topics across four groups, the daily story and the video. CI: typecheck, tests, formatting on every push; every push to `main` deploys.

## What it does

| View                                                  | Content                                                                                                                                                                                                                                                                                                                                        | Refresh        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **NOW**                                               | The composite: temperature field, live radar, trains, quakes, and a national summary strip. No further instruments.                                                                                                                                                                                                                            | —              |
| **WEATHER**                                           | MeteoSwiss SwissMetNet stations (temperature, wind, gusts, precipitation, snow), wind particles, a 5-minute precipitation radar with a scrubber, national extremes.                                                                                                                                                                            | 10 min / 5 min |
| **WATER**                                             | FOEN hydrology: river discharge and level, lake level, water temperature, flood danger levels; river widths follow discharge.                                                                                                                                                                                                                  | 10 min         |
| **RAIL**                                              | Trains interpolated from the GTFS timetable and GTFS-RT delays (Switzerland publishes no vehicle positions; every position is labelled as interpolated), delay marks, SBB disruptions, on-time index.                                                                                                                                          | 60 s           |
| **QUAKES**                                            | Swiss Seismological Service reviewed catalogue, last 30 days; the view appears in the rail only when there is a M ≥ 2 event.                                                                                                                                                                                                                   | 2 min          |
| **AIR**                                               | Zürich reference stations (CC0) on a short-term index, Sensor.Community particulate sensors as a separate citizen tier, MeteoSwiss pollen.                                                                                                                                                                                                     | hourly / 5 min |
| **HAZARDS**                                           | Forest-fire danger by region (FOEN, daily), avalanche bulletin regions (SLF, winter), IMIS snow stations, hail detected by radar (MeteoSwiss, in season), earthquakes (SED).                                                                                                                                                                   | 5 min – daily  |
| **ENERGY**                                            | Swissgrid live import and export per border as animated arrows (20-minute delay) and grid frequency; Energy-Charts production mix and day-ahead price; CHARTS shows the last day's mix.                                                                                                                                                        | 60 s / 15 min  |
| **EVENTS**                                            | Police communiqués and SRF headlines placed on the map by our own geocoding (municipality register, then the swisstopo gazetteer) with a confidence per event; headline, link and source only.                                                                                                                                                 | 5 min          |
| **POLITICS**                                          | Latest federal votes: yes-share per municipality (BFS), titles and results from swissvotes, next vote Sundays from the Federal Chancellery; TIMELINE scrubs through the recent votes.                                                                                                                                                          | weekly build   |
| **POPULATION**, **HOUSING**, **ECONOMY**, **TOURISM** | Statistics on the geo spine: permanent resident population and vacancy rate per municipality (BFS SDMX), full-time-equivalent jobs per municipality (BFS STATENT), hotel nights per canton and month (BFS HESTA), the KOF barometer; quantile-scaled choropleths, CHARTS with rankings and national courses, TIMELINE over vintages or months. | weekly build   |
| **AVIATION**                                          | Built and gated: aircraft over Switzerland at reported (never interpolated) positions with stepped trails. Hidden until a commercially clean feed or an agreement exists; the only source, adsb.fi, allows personal use only. `SWISS_NOW_ALLOW=adsb-fi` enables it for a local run.                                                            | 10 s           |
| **/today**                                            | The day's story: chapters ranked from 10-minute snapshots across the live topics (extremes, rainfall, delays, rivers, quakes, energy flows, hazards, events, air) and the latest vote in the week after a vote Sunday, scroll-driven over the live map, plus the video in a Remotion Player.                                                   | 10 min         |
| **/status**                                           | Freshness and source health.                                                                                                                                                                                                                                                                                                                   |                |

Topics sit in a rail (NOW · LIVE · SYSTEMS · SWITZERLAND) and are independent of the view mode (MAP · CHARTS · TIMELINE · COMPARE); the view is a URL (`?topic=politics&mode=timeline&t=6860`, `?topic=population&mode=compare&place=261,351`). TIMELINE scrubs the last 48 hours of 10-minute snapshots for the live topics, radar frames for weather, votes and vintages for the statistics; COMPARE puts two places side by side with the same figures. Keyboard: `[` `]` topics, `1`–`4` modes, `Esc` back to NOW, `/` place search. See [`docs/IA.md`](docs/IA.md). Every value carries an observation time and a source; freshness (`live · aging · stale · outage`) changes the rendering. A home place (stored locally, no account) makes the summary strip local.

## How it works

```
Swiss open data → adapters (packages/core) → SwissNowState → tokens + motion math (packages/motion)
                                                            ├─ apps/web      React · MapLibre GL · WebGL · Motion
                                                            └─ story-video   Remotion, rendered by apps/video and played on /today
```

- **Ingestion.** Small live sources are read through pull-through cached route handlers (`/api/state/*`): one upstream fetch per cadence, CDN `stale-while-revalidate` for everyone else, browsers never call Swiss APIs. Heavy work runs outside request time: the twice-weekly GTFS build (GitHub Actions, `gtfs.yml`) and the 10-minute composite snapshots (written by visitors on the free tier, optionally by a scheduled ping).
- **Contracts.** `packages/core/src/state` holds the zod schemas: entities (`Station`, `Observation`, `Field`, `Event`, `TripSnapshot` with a mandatory `positionKind`), one state per layer, the composite `SwissNowState`, and `StorySpec`. Provider schemas never leave their adapter.
- **Rendering split.** The map and its data layers are React, MapLibre GL and custom WebGL; UI transitions use Motion; Remotion is used only for the time-based composition. Web and video share contracts, design tokens and animation math, never a renderer.
- **Video.** `packages/story-video` renders a `StorySpec` over a fixed MapLibre plate (the renderer camera moves only at cuts, under a dip to paper; motion within a chapter is a CSS transform). Chapter markers travel inside the story, so the video needs no state lookups; energy chapters draw the border arrows, vote chapters a municipality choropleth from the geo spine, both projected on the plate. Renders run locally under the free Remotion licence.
- **Statistics.** SWITZERLAND topics are static JSON built by `build-data` (BFS PxWeb and SDMX, swissvotes, LINDAS) and joined to the map through the geo spine: municipality polygons from swissBOUNDARIES3D and the BFS register, keyed by BFS number (`packages/geo-build`).
- **Cost.** Free tiers only: Vercel Hobby, Vercel Blob, GitHub Actions, Remotion free licence. See `docs/FREE_TIER_ARCHITECTURE.md`.

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), [`docs/MOTION_SYSTEM.md`](docs/MOTION_SYSTEM.md), [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

## Repository layout

```
apps/
  web/            Next.js 16 app: map, HUD, /today, /status, API route handlers, snapshot store
  video/          Remotion project: registers the compositions, story fixtures, local renders
packages/
  core/           @swiss-now/core   state contracts, source registry, freshness, adapters, snapshot + story builders, CLIs
  motion/         @swiss-now/motion design tokens, scales, deterministic animation math, SVG primitives
  story-video/    @swiss-now/story-video  the "Switzerland Today" composition (the only package that imports Remotion)
  geo-build/      build-time geo scripts, pure JS: forked basemap style, boundaries + register (geo spine)
docs/             product vision, data-source matrix, architecture, free-tier plan, deployment, motion system, IA, open questions
.github/          ci.yml (checks), gtfs.yml (rail data build), data.yml (weekly statistics build), snapshot.yml (10-minute snapshot ping)
```

Dependency rules: `core` and `motion` never import React DOM, MapLibre, Motion or Remotion. `apps/web` and `apps/video` never import each other; shared code lives in packages. Workspace packages are consumed from `src/` without a build step.

## Getting started

Requirements: Node 22, pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm --filter @swiss-now/web dev        # http://localhost:3000
```

Weather, water and quakes work without configuration. Rail needs a free API key and two generated files:

```bash
# apps/web/.env.local
OTD_API_KEY=…                           # api-manager.opentransportdata.swiss, self-service

pnpm --filter @swiss-now/core build-gtfs -- --out apps/web/public/rail --days 7   # downloads the 248 MB GTFS, ≈ 3 min
pnpm --filter @swiss-now/core build-rail-paths -- --rail apps/web/public/rail     # SBB + BAV line graph → one path per stop sequence
```

Environment variables:

| Variable                | Used by              | Purpose                                                                       |
| ----------------------- | -------------------- | ----------------------------------------------------------------------------- |
| `OTD_API_KEY`           | web                  | GTFS-RT delays. Without it trains follow the timetable and are marked stale.  |
| `RAIL_DATA_DIR`         | web                  | Generated rail files; default `apps/web/public/rail`.                         |
| `RAIL_DATA_URL`         | web                  | Read rail files from a public URL (Vercel Blob) instead of the directory.     |
| `SNAPSHOT_DIR`          | web                  | Local snapshot directory; default `apps/web/public/snapshots`.                |
| `BLOB_READ_WRITE_TOKEN` | web, `gtfs.yml`, CLI | Vercel Blob for snapshots and rail files once deployed.                       |
| `DATA_BASE_URL`         | web                  | Read the statistics files from a public URL instead of `public/data`.         |
| `SWISS_NOW_ALLOW`       | web                  | Comma-separated source ids to enable despite the licence policy (local only). |

### Statistics data

```bash
pnpm --filter @swiss-now/core build-data votes -- --sundays 4     # BFS vote results → apps/web/public/data/politics
pnpm --filter @swiss-now/core build-data stats                    # BFS SDMX/PxWeb indicators + KOF → apps/web/public/data/stats
pnpm --filter @swiss-now/geo-build build-boundaries -- --vintage 2026   # geo spine (yearly)
```

Committed as the development fallback; `data.yml` refreshes the vote files weekly. `DATA_BASE_URL` / `NEXT_PUBLIC_DATA_BASE_URL` point the app at Vercel Blob once deployed.

### Video

```bash
pnpm --filter @swiss-now/video story:fetch      # save today's story as apps/video/fixtures/story-<date>.json
pnpm --filter @swiss-now/video render:today     # → apps/video/out/today.mp4 (1080×1920, ≈ 90 s for five chapters)
pnpm --filter @swiss-now/video studio           # Remotion Studio
```

Details and the landscape variant: [`apps/video/README.md`](apps/video/README.md).

### Checks

```bash
pnpm typecheck && pnpm test && pnpm format:check
```

Map behaviour is verified against a production build with Chromium's software WebGL renderer: `node apps/web/scripts/qa-rail-hover.mjs` (rail groups and modes, hover cards, choropleths, timelines, compare, the licence gate, Today page and the embedded Player). See [`apps/web/README.md`](apps/web/README.md).

## Data sources and attribution

MeteoSwiss (CC BY 4.0), Federal Office for the Environment FOEN via LINDAS, swisstopo (basemap, © swisstopo), Open Data Platform Mobility Switzerland (GTFS, GTFS-RT), SBB and the Federal Office of Transport (line geometry, disruptions), Swiss Seismological Service at ETH Zurich. Attribution strings are served from the source registry and shown in the app and in the video credits.

Interpolated train positions are estimates from the timetable and published delays, never GPS. The SED catalogue is used under non-commercial terms pending clarification. Swiss Now is not an official warning channel. Licences and open points per source: [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md), [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md).

## Roadmap

| Phase | Scope                                                                                                                                                                              | Status  |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | Workspace, contracts, tokens, forked basemap, first cached handler, spikes                                                                                                         | done    |
| 1     | Weather and water layers, radar, wind, HUD, home place                                                                                                                             | done    |
| 2     | Rail: GTFS pipeline, route paths, interpolated trains, delays, disruptions                                                                                                         | done    |
| 3     | Quakes, snapshots, story builder, `/today`                                                                                                                                         | done    |
| 4     | "Switzerland Today" composition, local rendering, Player on `/today`                                                                                                               | done    |
| E1–E6 | Expansion: topics × modes IA, geo spine, Politics · Energy + Events · Air + Hazards · Statistics + CHARTS · TIMELINE + COMPARE · story/video across the new topics, gated Aviation | done    |
| —     | Deployment: Vercel Hobby live; Blob store, rail token and ping variable per `docs/DEPLOYMENT.md`                                                                                   | live    |
| E7    | Polish, mobile, languages, docs                                                                                                                                                    | planned |

## Licence

Code: MIT. Data: per source as listed above. Map data © swisstopo.

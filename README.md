# Swiss Now

**A living, near-real-time map of Switzerland.**

Open it and the country is already moving: rain drifting over the Jura, trains sliding through the Gotthard, the Rhine rising at Basel, a tremor pulsing in Valais. Swiss Now turns official Swiss open data into one normalized state that feeds two rendering targets — an interactive web map and Remotion story videos ("Switzerland Today in 30 seconds").

> Status: **Phase 0 — foundations.** Planning is complete (see [`docs/`](docs/)); the workspace and the normalized state contracts exist; no UI yet.

```
Swiss open data  →  adapters  →  SwissNowState  →  shared visual & motion system  →  A. interactive web  |  B. Remotion video
```

## Why

Dashboards get one visit. Swiss Now is designed around daily moments: _what is it like out there right now_, _is my commute broken_, _something is happening_, _is the weekend plan on_, _show me Switzerland_, _what happened today_. The default view answers these without interaction; one personalisation lever (a home place, stored locally) makes it about your Switzerland; a daily auto-assembled story closes the loop.

Design direction: Swiss modernism, strong typography, cartographic beauty, restrained colour, motion as information. Not a SaaS dashboard.

## What it shows (MVP)

| Layer       | Data                                                                                                                                                                        | Cadence        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **WEATHER** | MeteoSwiss SwissMetNet stations (temperature, wind, precipitation, snow), 5-minute precipitation radar                                                                      | 10 min / 5 min |
| **WATER**   | FOEN hydrology: river discharge and level, lake level, water temperature, flood danger levels                                                                               | 10 min         |
| **RAIL**    | Trains interpolated from GTFS schedules and live delays (Switzerland publishes no vehicle positions — every position is labelled _interpolated_), delay pulses, disruptions | 60 s           |
| **QUAKES**  | Swiss Seismological Service catalogue                                                                                                                                       | event-driven   |
| **NOW**     | the curated composite and a national summary strip, nothing else; `/today` tells the day's story from the 10-minute snapshots                                               | —              |

Traffic (FEDRO), city-scale air quality and energy follow in later phases. See [`docs/MVP_PLAN.md`](docs/MVP_PLAN.md) for the reasoning and [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) for the 48-row scored data-source matrix.

## Principles

1. **The map is the hero.** UI recedes into a typographic HUD.
2. **Motion is information.** Everything that moves encodes a real quantity.
3. **Honest data.** Timestamp and source on every value; freshness states (`live · aging · stale · outage`) change the rendering; interpolation is always labelled.
4. **One data model, two renderers.** Shared contracts and design tokens, rendering technology chosen per component.
5. **Respect the sources.** One request per cadence from our servers; browsers never call Swiss APIs; attribution everywhere.
6. **Free until it matters.** The MVP runs on free tiers only (Vercel Hobby, GitHub Actions, Vercel Blob, Supabase Free, Remotion free licence). See [`docs/FREE_TIER_ARCHITECTURE.md`](docs/FREE_TIER_ARCHITECTURE.md).

## Architecture in one paragraph

Small live sources are read through **pull-through cached route handlers** on Vercel: the Data Cache coalesces all traffic into one upstream fetch per cadence and the CDN serves everyone else with `stale-while-revalidate`. Heavy or always-on work (240 MB GTFS processing, 10-minute snapshots, the daily story) runs on **GitHub Actions** and writes to **Vercel Blob**. Every adapter converts provider schemas into the normalized **`SwissNowState`** (zod contracts in `packages/core`). The web app renders it with **React, MapLibre GL, deck.gl and custom WebGL**, with **Motion/GSAP** for UI; **Remotion** renders the same state and story spec into video, locally, under the free licence. Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/MOTION_SYSTEM.md`](docs/MOTION_SYSTEM.md).

## Repository layout

```
swiss-now/
├─ apps/
│  ├─ web/          Next.js 16 interactive experience: live map, HUD, /today story with the Remotion Player
│  └─ video/        Remotion project: registers the compositions, keeps story fixtures, renders locally
├─ packages/
│  ├─ core/         @swiss-now/core — SwissNowState contracts (zod), freshness model, source registry, adapters
│  ├─ motion/       @swiss-now/motion — tokens, scales, animation math, SVG primitives, scene specs
│  ├─ story-video/  @swiss-now/story-video — the "Switzerland Today" Remotion composition (fixed map plate, chapters, markers)
│  └─ geo-build/    build-time geodata conversion (swissBOUNDARIES3D, rail lines, TMC lookup)
├─ docs/            planning documents (vision, data sources, architecture, free tier, motion, MVP plan, open questions)
├─ .agents/skills/  official Remotion Agent Skills (installed via `npx skills add remotion-dev/skills`)
└─ .github/         CI and, later, the scheduled data workflows
```

Dependency rules: `packages/core` and `packages/motion` never import React-DOM, MapLibre, GSAP, Motion or Remotion. `apps/web` and `apps/video` never import each other; anything both need moves into a package — which is why the composition lives in `packages/story-video`: the web Player and the renderer mount the same code.

## The Swiss Now State

`packages/core/src/state` defines the contracts every renderer speaks:

- **Primitives** — `LonLat` (WGS84 `[lon, lat]`), `ISODateTime` (offset required), `LocalizedText` (de/fr/it/rm/en), `LayerId`, `Freshness`, `CantonCode`.
- **Entities** — `Station`, `Observation` (typed `Parameter` with fixed units), `Field` (raster frame on Blob), `Segment`, `Event` (incidents, floods, quakes, avalanches…), `TripSnapshot` with a **mandatory `positionKind: "interpolated" | "reported"`**.
- **Layers** — `WeatherState`, `HydrologyState`, `RailState`, `SeismicState`, and Phase-5 `TrafficState`, `AirState`, `EnergyState`; each carries `schemaVersion`, `updatedAt`, `observedAt`, `freshness`, `sources`.
- **Summary** — national and per-canton `KPI`s with baselines and anomaly scores.
- **StorySpec** — ordered chapters with camera specs and duration hints; consumed by both the web "Today" mode and the Remotion compositions.
- **SwissNowState** — the composite.

`packages/core/src/sources/registry.ts` records licence, attribution string, commercial-use status and cadence for every source as verified on 2026-09-07. `packages/core/src/freshness` derives `live / aging / stale / outage` from observation age and source cadence.

## Development

Requirements: Node ≥ 22, pnpm 10 (via corepack: `corepack enable`).

```bash
pnpm install
pnpm typecheck
pnpm test
```

Formatting: `pnpm format`. Tests use Vitest.

Workspace packages are consumed **just-in-time** from `src/` (their `exports` point at TypeScript sources), so no build step is needed for development; Next.js (`transpilePackages`), Remotion's bundler, Vitest and `tsx` all handle TypeScript directly.

## Data sources and attribution

All sources are official Swiss open data or free public services. Attribution strings are served from the source registry and shown in the app and in every video end card. Principal providers: MeteoSwiss (CC BY 4.0), Federal Office for the Environment FOEN, Federal Office of Topography swisstopo (© swisstopo), Open Data Platform Mobility Switzerland, SBB, Federal Office of Transport, Swiss Seismological Service at ETH Zurich, WSL Institute for Snow and Avalanche Research SLF, Swiss Federal Office of Energy, Federal Statistical Office. Licences and open questions per source are documented in [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) and [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md).

Interpolated train positions are estimates derived from schedules and published delays; they are never GPS positions. Swiss Now is not an official warning channel.

## The video

`/api/story/today` ranks the day's snapshots into a `StorySpec`; the same spec drives the scroll-driven `/today` page and the Remotion composition `SwitzerlandToday` (1080 × 1920, plus a 1920 × 1080 variant). The composition renders title → chapters → credits over one fixed MapLibre plate of the forked swisstopo style: the renderer camera only jumps at cuts, hidden by a dip to paper, and the push-in within a chapter is a CSS transform (Remotion's render-stability technique). Chapter markers travel inside the story (coordinates included), so the video needs no state lookups. Renders happen locally under the free licence; a five-chapter story renders in about 90 s on a laptop:

```bash
pnpm --filter @swiss-now/video story:fetch      # save today's story as a fixture
pnpm --filter @swiss-now/video render:today     # → apps/video/out/today.mp4
```

On `/today` the same composition plays in a Remotion `<Player>` (mounted on demand). Details in [`apps/video/README.md`](apps/video/README.md).

## Roadmap

| Phase | Scope                                                                                                       | Status                                           |
| ----- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 0     | Workspace, state contracts, tokens, forked map style, first cached handler, performance and Remotion spikes | done                                             |
| 1     | Weather + Water layers, HUD, place focus, NOW composite                                                     |                                                  |
| 2     | Rail: GTFS pipeline, route paths, interpolated trains, delays, disruptions                                  | done (Blob hosting waits for the Vercel project) |
| 3     | Quakes, snapshots (story input), Today story, seasonal layers                                               | done                                             |
| 4     | Remotion "Switzerland Today" compositions, local rendering, Player on `/today`                              | done                                             |
| 5     | Traffic (FEDRO), city air quality, energy flows, polish                                                     |                                                  |

## Licence

Code: MIT. Data: per source, see above. Map data © swisstopo.

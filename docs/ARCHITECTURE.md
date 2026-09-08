# Swiss Now — Architecture

> Planning document · v1 · 2026-09-07 · Status: proposal for review
> Principles fixed for this plan: living interactive web app first; free-tier-first (see [FREE_TIER_ARCHITECTURE](FREE_TIER_ARCHITECTURE.md)); shared data contracts and visual system, two rendering targets, no unnecessary coupling (see [MOTION_SYSTEM](MOTION_SYSTEM.md)).

## 1. System overview

```
                         Swiss open data (all free)
   MeteoSwiss OGD · geo.admin GeoJSON/STAC · BAFU LINDAS · SED FDSN · GTFS / GTFS-RT · SBB/BAV geometry
   · SLF · SFOE CSV · ENTSO-E · sharedmobility · (Phase 5) FEDRO DATEX II
                                   │
            ┌──────────────────────┴───────────────────────┐
            │ Mode 1 — pull-through cache                   │ Mode 2 — scheduled writer
            │ (default, zero infrastructure)                │ (only where genuinely necessary)
            ▼                                               ▼
   apps/web  /api/state/{layer}  (Next.js route handler,     GitHub Actions `schedule` (public repo, free)
   single region fra1)                                       runs packages/core CLI:
     fetch(upstream, { next: { revalidate: cadence } })        build-gtfs (Mon/Thu) · snapshot (10 min) · story (daily)
     → parse → zod → reproject LV95→WGS84 → normalize        → Vercel Blob  state/…, snapshots/…, rail/paths/…
     → XState JSON                                            → Supabase Free (Phase 3+) aggregates & baselines
     → Cache-Control: s-maxage=cadence,
       stale-while-revalidate=5×cadence
            │                                               │
            └──────────────► SwissNowState ◄────────────────┘
                 (assembled in the client from per-layer responses + Blob URLs)
                                   │
                 ┌─────────────────┴──────────────────┐
                 ▼                                    ▼
   A. Interactive Web Experience             B. Remotion Story / Video Experience
   React 19 · Next.js 16 · MapLibre GL       apps/video: compositions consume the same
   deck.gl · custom WebGL · Motion/GSAP       XState / StorySpec JSON (fixtures locally,
   TanStack Query polling (visibility-aware)  calculateMetadata() fetch later); local render
```

**Load model.** Swiss APIs see at most one request per cadence per source from Swiss Now, regardless of visitor count. Browsers only talk to Vercel's CDN, Vercel Blob, and swisstopo's tile CDN. Nothing runs when nobody is watching, except the GitHub Actions snapshot cron.

## 2. Ingestion modes

### 2.1 Mode 1 — pull-through cache (MVP default)

A route handler per layer, e.g. `apps/web/app/api/state/weather/route.ts`:

1. `fetch(upstreamUrl, { next: { revalidate: CADENCE_SECONDS }, headers: { 'User-Agent': UA, 'If-None-Match': … } })` — the Vercel Data Cache (or `use cache` in Next 16) coalesces concurrent misses into one upstream fetch per cadence, because the function runs in a single region.
2. Parse (provider-specific `parse.ts`), validate with zod, reproject if needed, normalize into the layer's `XState`.
3. Respond with `Cache-Control: public, s-maxage=CADENCE, stale-while-revalidate=5*CADENCE`, an `ETag`, and `x-swiss-now-observed-at`.
4. On upstream failure: return the last good payload from the Data Cache if present with `freshness: 'stale' | 'outage'`; never return an error body to the map.

Fits every source whose raw payload is < 2 MB and whose "current state" is self-contained: geo.admin GeoJSON layers, `VQHA80.csv`, LINDAS SPARQL, SED FDSN, SLF, ENTSO-E, SFOE CSVs, sharedmobility, SIRI-SX, SBB rail-traffic-information.

**Exception — GTFS-RT TripUpdates.** The raw protobuf feed can exceed the 2 MB Data Cache item cap. The handler keeps the _normalized_ `RailState` (tens of KB) in the Data Cache and a module-level in-memory copy; CDN TTL 60 s. Polling only happens while a visitor has RAIL or NOW visible, which is the natural behaviour of pull-through.

**Exception — radar frames.** The 5-min HDF5 file (~50 KB) is decoded with `h5wasm` into a PNG (~30 KB) and written to Blob; the handler returns the frame list. If active-CPU measurements show this is too expensive, the decode moves to Mode 2 at 5-minute cadence.

### 2.2 Mode 2 — scheduled writer (only where necessary)

GitHub Actions workflows run Node scripts from `packages/core/src/cli`:

| Workflow                     | Schedule                                                                                         | Why it cannot be pull-through                                               | Output                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gtfs.yml`                   | Mon, Thu 16:30 CET (after the 15:00 RT switch)                                                   | 248 MB zip, ≈ 3 min streaming; BAV XTF + SBB lines → stitched graph, ≈ 40 s | `rail/{meta,stops,routes,patterns,distances}.json`, `rail/days/YYYYMMDD.json` (≈ 4.5 MB, ≈ 21 k trips), `rail/paths/{pathId}.json` (one per unique stop sequence, 20 m simplified, 9 k files / 41 MB) → workflow artifact; uploaded to Vercel Blob when the token secret exists; the web reads `RAIL_DATA_URL` or `public/rail/` |
| `snapshot.yml`               | not yet scheduled (Phase 3 ships visitor-driven `POST /api/snapshot`; a 10-min ping is optional) | history must exist when nobody is watching                                  | `snapshots/{slot}.json` → local dir or Blob; story and baselines are computed from the snapshot files, so Supabase is deferred                                                                                                                                                                                                   |
| `story.yml`                  | daily 21:30 CET                                                                                  | ranking over the day's snapshots                                            | `story/{date}.json` → Blob                                                                                                                                                                                                                                                                                                       |
| `forecast.yml`               | hourly                                                                                           | local-forecast files up to 33 MB                                            | `forecast/daily.json` → Blob                                                                                                                                                                                                                                                                                                     |
| `render.yml` (later, manual) | on demand                                                                                        | headless Chromium                                                           | `video/{date}.mp4` → Blob                                                                                                                                                                                                                                                                                                        |

Constraints: GitHub's 5-minute floor and hour-start jitter; scheduled workflows are disabled after 60 days without repository activity on public repos → keep committing or add a keep-alive commit step. Secrets live in GitHub Actions secrets.

### 2.3 Cadence table

| Source                                                        | Mode                 | TTL / cadence | Payload                  | Notes                                                |
| ------------------------------------------------------------- | -------------------- | ------------- | ------------------------ | ---------------------------------------------------- |
| geo.admin `messwerte` + `hydroweb` GeoJSON                    | 1                    | 300 s         | 50–200 KB each           | reproject EPSG:2056 → 4326; strip HTML `description` |
| MeteoSwiss `VQHA80.csv` (+ per-station `_t_now` for snow)     | 1                    | 600 s         | 16 KB                    | Windows-1252; UTC; tolerate 60-min degraded cadence  |
| MeteoSwiss radar RZC/CPC                                      | 1 (decode) → Blob    | 300 s         | 50 KB in / 30 KB out     | list today's STAC assets; ignore empty tomorrow item |
| MeteoSwiss local forecast (daily params)                      | 2                    | hourly        | ≤ 300 KB                 | for "tomorrow" in the story                          |
| BAFU LINDAS SPARQL                                            | 1                    | 600 s         | ~233 rows                | one POST; parse `+01:00` as instant                  |
| GTFS-RT TripUpdates                                           | 1 (normalized cache) | 60 s          | multi-MB in / ~50 KB out | ≤ 1 req/min upstream (limit 2/min)                   |
| GTFS-RT Service Alerts, SIRI-SX, SBB rail-traffic-information | 1                    | 120–300 s     | small                    |                                                      |
| GTFS static                                                   | 2                    | Mon + Thu     | 240 MB                   | discover newest resource via CKAN `package_show`     |
| SED FDSN (`text` format, `starttime=now-30d`)                 | 1                    | 120 s         | tiny                     |                                                      |
| SLF IMIS / bulletin, forest fire, SFOE, reservoir             | 1                    | 1–24 h        | small                    | seasonal layers                                      |
| ENTSO-E CH                                                    | 1                    | 900 s         | XML                      | token server-side                                    |
| sharedmobility GBFS                                           | 1                    | 60 s          | ~1 MB                    | Phase 5 optional                                     |
| FEDRO DATEX II                                                | 2 (archive)          | 5 min         | XML                      | Phase 5; derived values only in the public API       |
| Composite snapshot                                            | 2                    | 10 min        | 200–500 KB gz            | story input (timeline UI dropped)                    |

## 3. The Swiss Now State (data contracts)

All contracts live in `packages/core/src/state` as zod schemas with inferred TypeScript types; every payload carries `schemaVersion`.

```ts
type Freshness = "live" | "aging" | "stale" | "outage"; // derived from expected cadence per source

type SourceMeta = {
  id: SourceId;
  name: string;
  attribution: string;
  url: string;
  license: string;
  commercialUse: "yes" | "ask" | "no" | "unresolved";
};

type Station = {
  id: string;
  name: LocalizedName;
  lonLat: [number, number];
  elevation?: number;
  cantonCode?: string;
  bfsNumber?: number;
  kind: "weather" | "hydro" | "snow" | "air" | "stop";
};
type Observation = {
  stationId: string;
  parameter: Parameter;
  value: number;
  unit: string;
  observedAt: string;
  quality?: "ok" | "suspect" | "preliminary";
};
type Field = {
  id: string;
  kind: "radar-rain" | "temperature-grid";
  bounds: BBox;
  width: number;
  height: number;
  imageUrl: string;
  scaleId: string;
  validAt: string;
};
type Segment = {
  id: string;
  pathId: string;
  from?: string;
  to?: string;
  value: number;
  unit: string;
};
type Event = {
  id: string;
  kind:
    | "incident"
    | "roadwork"
    | "disruption"
    | "earthquake"
    | "flood-warning"
    | "avalanche"
    | "fire-danger";
  severity: 1 | 2 | 3 | 4 | 5;
  geometry: GeoJSON.Geometry;
  startsAt: string;
  endsAt?: string;
  headline: LocalizedText;
  affects?: string[];
};
type Vehicle = {
  tripId: string;
  routeId: string;
  pathId: string;
  positionKind: "interpolated" | "reported";
  progress: number;
  delaySeconds: number;
  nextStopId: string;
  nextStopAt: string;
};

type LayerBase = {
  schemaVersion: 1;
  updatedAt: string;
  observedAt: string;
  freshness: Freshness;
  sources: SourceId[];
};
type WeatherState = LayerBase & {
  stations: Station[];
  observations: Observation[];
  fields: Field[];
  extremes: Extremes;
};
type HydrologyState = LayerBase & {
  stations: Station[];
  observations: Observation[];
  dangerLevels: Record<string, 1 | 2 | 3 | 4 | 5>;
  warnings: Event[];
};
type RailState = LayerBase & {
  activeTrips: TripSnapshot[];
  pathsUrl: string;
  disruptions: Event[];
  onTimeIndex: number;
  baselineOnTimeIndex?: number;
};
type SeismicState = LayerBase & { events: Event[] };
type TrafficState = LayerBase & { segments: Segment[]; incidents: Event[] }; // Phase 5, derived only
type AirState = LayerBase & { stations: Station[]; observations: Observation[]; index?: number }; // Phase 5
type EnergyState = LayerBase & {
  load?: number;
  generationByType?: Record<string, number>;
  flows?: Record<string, number>;
};

type Summary = { national: KPI[]; byCanton: Record<string, KPI[]>; generatedAt: string };
type StorySpec = { date: string; chapters: Chapter[] };
type Chapter = {
  type: "weather-summary" | "extremes" | "rainfall" | "rail" | "river" | "quake" | "stat";
  headline: LocalizedText;
  data: unknown;
  camera: CameraSpec;
  layer: LayerId;
  durationHint: number;
};

type SwissNowState = {
  generatedAt: string;
  freshness: Record<LayerId, Freshness>;
  weather: WeatherState;
  hydrology: HydrologyState;
  rail: RailState;
  seismic: SeismicState;
  traffic?: TrafficState;
  air?: AirState;
  energy?: EnergyState;
  summary: Summary;
  meta: { sources: SourceMeta[] };
};
```

Rules:

- Provider schemas never leave `data-sources/<source>/parse.ts`. Nothing outside the adapter knows what `tre200s0` or `dx223:situationRecord` means.
- Every entity carries `observedAt`; every layer carries `freshness`. UI and video both render freshness.
- `positionKind` is mandatory on vehicles and is rendered differently; all Swiss trains are `interpolated`.
- Coordinates are WGS84 `[lon, lat]` everywhere outside build scripts.
- Layers are independently fetchable and independently versioned; the web app assembles `SwissNowState` client-side, Remotion loads it from a fixture or a single `snapshots/{ts}.json`.

## 4. Repository and folder architecture

pnpm workspace, single public repository.

```
swiss-now/
├─ apps/
│  ├─ web/                                  Next.js 16 App Router — the interactive experience
│  │  ├─ app/
│  │  │  ├─ (map)/page.tsx                  full-screen map shell (client tree, static HTML shell)
│  │  │  ├─ today/page.tsx                  web-native story + optional Remotion <Player>
│  │  │  ├─ status/page.tsx                 freshness / source health
│  │  │  └─ api/state/[layer]/route.ts      Mode 1 handlers; api/meta/sources
│  │  ├─ components/
│  │  │  ├─ map/                            LiveMap.tsx, layers/{WeatherField,RainField,WindParticles,RailLayer,TrainMarks,
│  │  │  │                                   RiverFlow,QuakeRings,CantonFocus}.tsx  (MapLibre + deck.gl + WebGL)
│  │  │  ├─ hud/                            SummaryStrip, LayerRail, Timeline, Legend, HoverCard, PlaceFocus (React + Motion/GSAP)
│  │  │  └─ story/                          TodayStory, Chapter*.tsx (React + Motion, scroll-driven)
│  │  └─ lib/                               queries (TanStack Query), polling policy, map style loader, daylight state
│  └─ video/                                Remotion 4.x — registers compositions, renders locally
│     ├─ src/Root.tsx                       SwitzerlandToday (1080×1920), SwitzerlandTodayWide, the Phase 0 spike
│     ├─ scripts/fetch-story.mjs            saves /api/story/today as a fixture
│     └─ fixtures/                          saved StorySpec / WeatherState JSON days (deterministic renders)
├─ packages/
│  ├─ core/      @swiss-now/core            pure TypeScript, no React/DOM
│  │  └─ src/{state, data-sources/<source>/{client,parse,normalize,index}.ts, geo, freshness, story, cli}
│  ├─ motion/    @swiss-now/motion          tokens, scales, math, stateless SVG primitives, scene specs
│  ├─ story-video/ @swiss-now/story-video   the Remotion composition: timeline, FixedMapPlate, Markers, hud/, SwitzerlandToday
│  │                                        (the only package importing Remotion; mounted by apps/video and by the web <Player>)
│  └─ geo-build/                            build-time GDAL/mapshaper scripts (boundaries, rail lines, TMC lookup)
├─ .github/workflows/                        gtfs.yml, snapshot.yml, story.yml, forecast.yml, render.yml
└─ docs/
```

Dependency rules: `core` and `motion` never import React-DOM, MapLibre, GSAP, Motion or Remotion (`motion/svg` imports React only). `apps/web` and `apps/video` never import each other. Anything both need moves down into a package — the composition itself is one such thing (`packages/story-video`), which is how the web Player and the renderer share code. The originally requested `/lib/data-sources/<source>` lives at `packages/core/src/data-sources/<source>/`.

## 5. Public internal API

| Route                                                                                  | Content                                                        | CDN TTL   |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------- |
| `GET /api/state/weather`                                                               | `WeatherState`                                                 | 300 s     |
| `GET /api/state/hydrology`                                                             | `HydrologyState`                                               | 600 s     |
| `GET /api/state/rail`                                                                  | `RailState` (trips reference `pathsUrl` on Blob)               | 60 s      |
| `GET /api/state/seismic`                                                               | `SeismicState`                                                 | 120 s     |
| `GET /api/state/summary`                                                               | `Summary` (served from Blob `state/summary.json` when present) | 300 s     |
| `GET /api/meta/sources`                                                                | attribution, licences, freshness expectations                  | 1 h       |
| Blob `snapshots/{ts}.json`, `rail/paths/*.json`, `radar/{ts}.png`, `story/{date}.json` | static, browser-fetched directly                               | ≥ cadence |

All responses < 1 MB gzip, `ETag`, `Vary` none. No user-specific data → everything cacheable. Derived values only for FEDRO (Phase 5).

## 6. Client architecture

- Static shell: the map page is statically generated; all data arrives via TanStack Query.
- Polling policy: `staleTime = cadence`, `refetchInterval = cadence + jitter(0–15 %)`, paused when `document.hidden`, per-layer enable flags (RAIL polls only when RAIL or NOW is active).
- Map: MapLibre GL JS **6.7** (decided in Spike A, see `docs/SPIKES.md`; ESM-only, WebGL2 required — the app degrades to an honest notice without WebGL2; the worker is served statically from `public/map/vendor/`) with a forked `lightbasemap.vt` style hosted in `apps/web/public/map/style.json`, tiles from swisstopo with attribution; vector hillshade from `relief.vt`; `@deck.gl/maplibre` `MapLibreOverlay` for point and path layers; a custom WebGL layer for wind particles; MapLibre `image` sources for radar frames; symbol layers for labels.
- Performance budget: ≤ 60 k points, ≤ 10 k particles desktop / 4 k mobile, 60 fps target on a 2022 laptop, 30 fps on a mid-range phone; no terrain (none available from swisstopo anyway).
- Interpolation: `positionAlongTrip(trip, path, now)` from `@swiss-now/motion` runs per animation frame on the client using the latest `RailState`; the same function runs per Remotion frame.

## 7. Storage

| Store                                     | Content                                                              | Retention                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Vercel Data Cache                         | last good `XState` per layer                                         | cadence-based revalidation; survives deploys                                                      |
| Vercel Blob                               | snapshots, GTFS-derived files, radar PNGs, story JSON, MP4s          | 48 h of 10-min snapshots → hourly for 30 days → daily forever; radar 3 h; paths latest + previous |
| Supabase Free Postgres (Zurich, Phase 3+) | `daily_summary`, `station_baseline`, `ontime_daily`, `source_health` | small aggregates only; no raw observations                                                        |
| GitHub repository                         | code, forked map style, simplified boundaries GeoJSON, TMC lookup    | versioned                                                                                         |

No Redis, no queues, no raw-observation warehouse in MVP.

## 8. Coordinate systems and encodings

- WGS84 `[lon, lat]` in every payload, component and composition.
- proj4 definition `EPSG:2056` (`+proj=somerc +lat_0=46.9524055555556 +lon_0=7.43958333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m`) applied once at ingest for geo.admin GeoJSON, radar bounds, swissBOUNDARIES3D and BAV lines.
- Decode Windows-1252 (SMN), Latin-1 (forecast), UTF-8-BOM (service points) explicitly.
- Parse timestamps with their offsets; never treat wall-clock strings as local time; `Europe/Zurich` only for display.

## 9. Failure handling and observability

- Per-source expected cadence → `freshness`; UI dims and labels (`last update 14:20`), video scenes skip or caption stale layers.
- zod failure = reject batch, keep last good, record in `source_health` (Blob `state/health.json` written by the snapshot job, plus in-handler logging).
- Upstream 4xx/5xx or timeout → stale-while-revalidate keeps serving; CDN `stale-if-error` is not supported on Vercel, so the handler itself returns the last good copy.
- Quota awareness: GTFS-RT ≤ 1 req/min; FEDRO budget counter persisted in Blob (Phase 5).
- `/status` page and a GitHub Actions failure notification are the alerting for MVP.

## 10. Legal guardrails in code

- `SourceMeta.commercialUse` gates layers: `ask`/`unresolved` sources are allowed while the project is non-commercial (Vercel Hobby) and flagged in `/status`; flipping to commercial requires them to be `yes`.
- No raw FEDRO payload passthrough; derived `Segment` values only.
- Attribution strings from `/api/meta/sources` render in a credits panel and in every video's end card.
- MeteoSwiss pictograms are never used; our own symbol set maps from symbol numbers.

## 11. Deployment

Vercel Hobby (personal, non-commercial), project region `fra1`, static generation for all pages, functions only for `/api/state/*`; Vercel Blob store in the same region; GitHub Actions on the public repo; Supabase Free in `eu-central-2` (Zurich) from Phase 3. Secrets: `OTD_API_KEY`, `ENTSOE_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `SUPABASE_*` in Vercel and GitHub. Upgrade path is described in FREE_TIER_ARCHITECTURE.

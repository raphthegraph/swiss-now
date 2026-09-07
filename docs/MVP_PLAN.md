# Swiss Now — MVP Plan

> Planning document · v1 · 2026-09-07 · Status: proposal for review

## 1. MVP scope

**Four layers, one composite, one story, zero infrastructure cost.**

| Rank | Layer                                                                      | Data                                                                                                                | Why it is in the MVP                                                                                                                                     |
| ---- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **WEATHER**                                                                | MeteoSwiss SMN 10-min stations (`VQHA80.csv` + geo.admin `messwerte` GeoJSON), 5-min radar (RZC/CPC)                | Freshest national data, no auth, CC BY, trivially ingested; strongest ambient visual (temperature field, rain, wind particles); highest daily usefulness |
| 2    | **WATER**                                                                  | BAFU LINDAS (level, discharge, temperature, danger level), geo.admin hydro class layers, national flood warning map | 10-min values, open-use licence, very Swiss; river-flow animation is distinctive; flood danger provides real events                                      |
| 3    | **RAIL** (trains only)                                                     | GTFS static + GTFS-RT TripUpdates, SIRI-SX / SBB disruption messages, SBB + BAV line geometry                       | Highest wow and commuter value; the hardest MVP item (no vehicle positions, no shapes → interpolation along external geometry, labelled as interpolated) |
| 4    | **QUAKES**                                                                 | SED FDSN reviewed catalogue                                                                                         | Near-zero cost, event-driven, dramatic when it happens, feeds the story; hidden when nothing happened in 30 days                                         |
| —    | **NOW composite, summary strip, place focus, timeline, web "Today" story** | all of the above + 10-min snapshots                                                                                 | This is the product; the layers are its material                                                                                                         |

### Challenging the initial intuition (weather → traffic → public transport → hydrology)

- **Traffic moves out of the MVP (to Phase 5).** The FEDRO feeds are SOAP/DATEX II in two schema versions, locations are ALERT-C/TMC codes needing a lookup table, standard access is capped at 260 000 calls over 6 months, raw redistribution via a machine-readable interface is prohibited, and a good visual needs segment geometry. The data is excellent but the cost/benefit is the worst of the candidates for a first release. Start the ASTRA quota/partner conversation during the MVP so Phase 5 is not blocked.
- **Hydrology moves up to second.** It is nearly as easy as weather, has an official open API with a permissive licence, and offers both ambient motion (flow) and events (danger levels).
- **Quakes come in early** because the adapter is a day of work and the visual payoff on the day of an event is enormous. Licence caveat: fine for a non-commercial MVP; clear it before commercialisation.
- **Air quality drops out** because NABEL has no machine-readable feed; a city-scale AIR layer (Zürich, Basel) is Phase 5.
- **Energy is a daily story element**, not a live layer: no realtime Swiss feed exists; ENTSO-E hourly flows can animate import/export arrows in Phase 5.

## 2. Phases

Durations assume one developer working part-time; they are sequencing guidance, not commitments.

### Phase 0 — Foundations (1–2 weeks)

- pnpm workspace: `apps/web`, `apps/video`, `packages/core`, `packages/motion`, `packages/geo-build`; TypeScript strict; zod; Vitest.
- `packages/core`: `SwissNowState` and layer schemas, `Freshness` model with per-source cadence table, `SourceMeta` registry with licences and attribution strings.
- `packages/motion`: tokens (colour scales, type, spacing, easing, durations, daylight states), first scales, `positionAlongPath` stub, `<Metric>` primitive.
- Design sprint: fork `ch.swisstopo.lightbasemap.vt` into a near-monochrome Swiss Now style with `relief.vt` hillshade; typography choice; HUD layout on desktop and phone; layer accent palette; environmental states.
- One pull-through handler end to end (`/api/state/weather` from the geo.admin temperature layer) with Data Cache + CDN headers verified via `x-vercel-cache` in Vercel logs; `/status`.
- **Spike A**: MapLibre + forked style + one deck.gl layer at 60 fps on a 2022 laptop and ≥ 30 fps on a mid-range phone; decide MapLibre 5.24 vs 6.x.
- **Spike B**: a 3-second Remotion fixed-plate render of the same style and tokens locally (`--gl=angle`, concurrency 1) to prove the shared design system works in both targets.
- Register the opentransportdata API key; email SED about licence; note FEDRO contact for Phase 5.
- No database.

### Phase 1 — Weather + Water (2–3 weeks)

- Adapters: `geoadmin` (messwerte + hydroweb layers, proj4 reprojection, HTML stripping), `meteoswiss` (`VQHA80.csv`, per-station snow depth, radar STAC listing + h5wasm decode → PNG → Blob), `hydrology` (LINDAS SPARQL).
- Map: temperature field (worker-interpolated grid → fill/raster), wind particles (custom WebGL layer), precipitation radar frames (`image` source, last 3 h retained), station hover cards, extremes ranking; rivers with flow animation scaled by discharge vs normal, lake levels, water temperature, danger-level pulses, flood warning polygons.
- HUD: summary strip v1, layer rail, legends, place focus + home place (localStorage), daylight state.
- NOW composite rules v1 (thresholds for what shows by default).
- Measure edge requests and CPU per visitor-hour.

### Phase 2 — Rail (3–4 weeks)

- GitHub Actions `gtfs.yml`: download newest GTFS via CKAN `package_show`, build trip patterns and stop sequences for train routes (route types rail), map-match stop sequences to SBB `linie-mit-polygon` + BAV network geometry → `rail/paths/*.json`, `rail/patterns.json` to Blob.
- `/api/state/rail`: TripUpdates protobuf → normalized `RailState` (active trips with delays, next stops), 60-s TTL, normalized-only caching; SIRI-SX / SBB messages → disruptions.
- Client: `positionAlongTrip` per rAF, trains as soft marks styled as **interpolated**, delay pulses, route lines, disruption cards, national on-time index; commute-hour promotion in NOW.
- Measure active CPU; adjust cadence or move parsing to Actions if needed.

### Phase 3 — Quakes, timeline, Today story (2 weeks)

- `earthquakes` adapter (FDSN `text` format, 30-day window, reviewed-status flag), rings and list; QUAKES appears in the rail only when active.
- `snapshot.yml` every 10 min → Blob; GSAP timeline scrubber animating fields between snapshots; retention thinning.
- Supabase Free (Zurich): daily aggregates and baselines (extremes, discharge percentiles, on-time %); `source_health`.
- Story builder: anomaly ranking → `StorySpec`; web-native "Today" mode with scroll-driven chapters and camera moves; DE/EN copy templates.
- Seasonal adapters if in season: SLF avalanche bulletin + IMIS (winter), forest fire danger (summer).

### Phase 4 — Remotion story (2 weeks, can overlap Phase 3)

- `apps/video`: `SwitzerlandToday` vertical and landscape compositions; scenes (weather summary, extremes, rainfall, rail, river, quake if any, statistic of the day) built from `@swiss-now/motion` primitives and tokens; FixedMapPlate; `calculateMetadata` from a fixture or `story/{date}.json`.
- Local rendering only; MP4 uploaded to Blob manually; optional `<Player>` on `/today`.
- Design and dry-run (but do not enable) an automated nightly render on GitHub Actions or Vercel Sandbox.

### Phase 5 — Traffic, Air, Energy, polish

- After ASTRA quota/partner clarification: DATEX II situations + counters via Actions archive job, TMC lookup, derived congestion index per segment, incidents (never raw passthrough).
- City-scale AIR (Zürich UGZ hourly, Basel data.bs.ch), computed Cercl'Air index.
- ENERGY: ENTSO-E hourly import/export arrows; SFOE daily mix in the story once `terms_by_ask` permission is on file.
- Optional: sharedmobility live positions at city zoom, Alplakes lake temperature once terms are clear.
- Performance pass, accessibility, FR/IT copy, mobile refinements.

## 3. Build order inside Phase 0–1 (what to build first)

1. Workspace + `SwissNowState` schemas + `SourceMeta` registry.
2. `packages/motion` tokens and the forked map style (design decisions made once, used everywhere).
3. `/api/state/weather` pull-through with verified caching.
4. Live map showing the temperature layer with hover — the first "living" moment.
5. Spike A (performance) and Spike B (Remotion plate) in parallel.
6. Then radar, wind, water.

## 4. Risks and mitigations

| #   | Risk                                                                                  | Likelihood         | Impact                | Mitigation                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------- | ------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Train interpolation looks wrong or dishonest without vehicle positions or GTFS shapes | High               | High                  | Map-match to SBB/BAV geometry; soft "interpolated" styling with a legend note; ship delay index and disruptions before movement; restrict to trains |
| 2   | Vercel Hobby active-CPU budget exhausted by the 60-s rail parse                       | Medium             | Medium (30-day pause) | Lean protobuf parsing; precomputed patterns; visibility-aware polling; measure in Phase 2; fallback to 120-s TTL; upgrade trigger documented        |
| 3   | SED licence disallows commercial reuse                                                | Medium             | Medium                | Non-commercial MVP; written clarification; layer gated by `commercialUse` flag                                                                      |
| 4   | Radar HDF5 decoding in a Node function is too slow or h5wasm fails on ODIM files      | Medium             | Medium                | Spike early in Phase 1; fallback to GitHub Actions decode at 5-min cadence                                                                          |
| 5   | Headless MapLibre rendering in Remotion is unstable or slow                           | Medium             | Medium                | Spike B in Phase 0; fixed-plate technique; local tile mirror; scene chunking                                                                        |
| 6   | Upstream churn (endpoints, encodings, CRSs, broken swisstopo style)                   | High               | Low–Medium            | zod validation, `source_health`, changelog RSS subscriptions, fallback sources per layer                                                            |
| 7   | FEDRO quota/terms block Traffic indefinitely                                          | Medium             | Low for MVP           | Traffic is Phase 5; start the conversation early                                                                                                    |
| 8   | GitHub Actions jitter or 60-day auto-disable breaks snapshots                         | Medium             | Low                   | Keep-alive commits; tolerate ±5 min in the timeline; alert on missed snapshots                                                                      |
| 9   | A beautiful demo that nobody revisits                                                 | Medium             | High                  | Home place, commute-hour rail promotion, daily story, honest freshness; measure returning visitors from day one                                     |
| 10  | Vercel Hobby non-commercial rule vs future monetisation                               | Certain eventually | Low                   | Pro is the documented first paid step                                                                                                               |

## 5. Definition of done for the MVP

- The default view answers "what is it like out there" and "is my commute broken" within 5 seconds on a phone.
- Four layers live with honest freshness states and attribution; timeline for weather and water; Today story assembled daily.
- One `SwitzerlandToday` video rendered locally from the same data as the site.
- Total monthly infrastructure cost: domain only.

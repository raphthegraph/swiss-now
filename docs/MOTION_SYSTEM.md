# Swiss Now — Motion System

> Planning document · v1 · 2026-09-07 · Status: proposal for review
> One visual language, two clocks. The website runs on real time and user input; Remotion runs on frames. Everything shared is clock-agnostic.

## 1. The split

| Concern                                                                                                                               | Technology                                                                                                   | Where                                            |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Live interactive map: basemap, camera, zoom/pan, data layers, particles, fields, flows, train movement, continuously updating visuals | **React + MapLibre GL + deck.gl + custom WebGL/Canvas + SVG overlays**                                       | `apps/web/components/map`                        |
| UI: layer rail, summary strip, panels, hover cards, timeline scrubber, scroll-driven story chapters, micro-interactions               | **Motion** (UI transitions, layout, enter/exit) and **GSAP** (scrubbing, complex sequenced HUD choreography) | `apps/web/components/hud`, `components/story`    |
| Choreographed time-based sequences: "Switzerland Today", explainers, replayable stories, MP4s for Shorts/Reels/TikTok                 | **Remotion**                                                                                                 | `packages/story-video`, rendered by `apps/video` |
| A genuine time-based composition inside the website                                                                                   | **Remotion `<Player>`**, only on `/today`                                                                    | `apps/web/components/story/StoryPlayer.tsx`      |
| Design tokens, scales, animation math, stateless SVG primitives, scene specs                                                          | **`@swiss-now/motion`** (framework-agnostic; SVG primitives are React components with a `progress` prop)     | `packages/motion`                                |

Remotion never drives the live map or the HUD. MapLibre never renders inside a Remotion composition except through the fixed-plate technique described in §5. Motion/GSAP never appear in `apps/video` (Remotion forbids browser-timed animation).

## 2. Shared foundation (`@swiss-now/motion`)

### 2.1 Tokens

- **Colour**: near-monochrome ground (`ink`, `paper`, four daylight variants dawn/day/dusk/night derived from sun altitude over Bern); one accent per layer — weather: diverging cool→warm scale for temperature, single blue-grey ramp for rain intensity; water: one blue with lightness encoding level vs normal; rail: Swiss red reserved for delay only, trains neutral; traffic: amber; air: violet-grey; energy: yellow-green; quakes: orange. Colour-blind-safe checks on every scale.
- **Type**: a Swiss grotesk with tabular figures (candidate open fonts to evaluate in Phase 0: Inter Tight, Instrument Sans, Public Sans; final licence check in OPEN_QUESTIONS); scale 12/14/16/20/28/40/64; uppercase tracking for the layer rail.
- **Spacing**: 4-px grid; HUD margins 24/32/48 by breakpoint.
- **Easing**: house curve `cubic-bezier(0.16, 1, 0.3, 1)`; `linear` for data-driven continuous motion; springs only for UI.
- **Durations**: 120 ms (hover), 240 ms (panel), 480 ms (layer switch), 900 ms (camera glide), 1 800 ms (story chapter transition).
- **Freshness styling**: `live` full colour · `aging` 85 % saturation · `stale` 55 % + label · `outage` 30 % + notice.

Tokens are exported as a TypeScript object and as CSS custom properties; Remotion imports the object, the web imports both.

### 2.2 Scales

d3-scale based mappings, one per encoding: `temperatureColor(°C)`, `rainIntensityColor(mm/h)`, `windParticleDensity(km/h)`, `dischargeToFlowSpeed(ratioToNormal)`, `delayToPulseRadius(seconds)`, `magnitudeToRings(M)`, `dangerLevelColor(1–5)`. Legends are generated from the same scale objects so web and video legends match exactly.

### 2.3 Math (pure functions of time)

- `positionAlongTrip(trip, path, t)` → `{ lonLat, bearing, progress }` from GTFS stop times + delays + route path; identical output on web (`t = Date.now()`) and video (`t = frameToTime(frame)`).
- `particleField(seed, bounds, count)` and `advect(particles, windGrid, dt)` — deterministic given a seed; web seeds randomly per session, Remotion seeds with the composition id.
- `pulseEnvelope(t, period, decay)`, `ringRadius(t, magnitude)`, `flowDashOffset(t, speed)`, `easeHouse(t)`.
- `cameraPath(from, to, t)` and `fitSwitzerland(viewport)` for consistent framing.

### 2.4 Stateless SVG primitives

`<Metric value progress format />`, `<Pulse progress severity />`, `<FlowArrow progress from to />`, `<CantonShape id highlight progress />`, `<CityLabel name priority />`, `<TimelineBar progress ticks />`. They take `progress ∈ [0,1]` (or explicit values) and own no timers. Web wraps them in Motion (`animate` drives `progress`), Remotion drives `progress` from `interpolate(frame, …)`.

### 2.5 Scene specs

`StorySpec` and `CameraSpec` types shared by the web "Today" mode and the Remotion compositions. The story builder in `@swiss-now/core` produces them; both renderers consume them. This is the coupling we _want_: the same narrative, not the same DOM.

## 3. Component technology map

A = interactive web, B = Remotion. "Shared" = code from `@swiss-now/motion` or `@swiss-now/core` used by both.

| Component                                    | Pure React                               | MapLibre                                                           | Canvas / WebGL                                   | Motion / GSAP            | Remotion                                                       | Shared                                    |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ | ------------------------ | -------------------------------------------------------------- | ----------------------------------------- |
| AnimatedSwissMap (basemap, camera, zoom/pan) |                                          | A: live map, `easeTo` with house curve                             |                                                  |                          | B: FixedMapPlate                                               | style JSON, camera specs, tokens          |
| WeatherField (temperature)                   |                                          | A: fill/raster layer from a server-interpolated PNG or client grid | A: grid interpolation in a Web Worker            |                          | B: PNG frames crossfaded                                       | `temperatureColor`, grid math             |
| RainField (radar frames)                     |                                          | A: `image` source, crossfade between frames                        |                                                  |                          | B: frame sequence per `frame`                                  | frame list from `Field[]`, scale          |
| WindParticles                                |                                          |                                                                    | A: custom WebGL layer (GPU, 4–10 k particles)    |                          | B: Canvas 2D simulation stepped per frame (CPU, deterministic) | `particleField`, `advect`                 |
| TrafficFlow (Phase 5)                        |                                          | A: line layers                                                     | A: deck.gl `PathLayer` with animated dash offset |                          | B: SVG paths on plate                                          | segment → colour/width                    |
| TrafficIncident (Phase 5)                    |                                          | A: symbol layer                                                    |                                                  | A: pulse via Motion      | B: SVG pulse                                                   | `pulseEnvelope`                           |
| RailRoute                                    |                                          | A: line layer from `rail/paths`                                    |                                                  |                          | B: SVG line on plate                                           | path GeoJSON                              |
| TrainMovement                                |                                          |                                                                    | A: deck.gl `ScatterplotLayer` updated each rAF   |                          | B: same positions per frame                                    | `positionAlongTrip`                       |
| DelayPulse                                   |                                          |                                                                    | A: deck.gl radius animation                      |                          | B: SVG rings                                                   | `delayToPulseRadius`                      |
| RiverFlow                                    |                                          | A: `line-dasharray` offset animation, speed ∝ discharge            |                                                  |                          | B: SVG dashed path                                             | `dischargeToFlowSpeed`, `flowDashOffset`  |
| EarthquakePulse                              |                                          |                                                                    | A: deck.gl rings or SVG overlay                  |                          | B: SVG rings                                                   | `ringRadius`                              |
| EnergyFlow (Phase 5)                         | A: SVG overlay between CH and neighbours |                                                                    |                                                  | A: entrance via Motion   | B: SVG                                                         | flow → particle density                   |
| AnimatedMetric (summary strip numbers)       | A                                        |                                                                    |                                                  | A: number tween (Motion) | B: `interpolate`                                               | `<Metric>`, formatters                    |
| AnimatedTimeline                             | A                                        |                                                                    |                                                  | A: GSAP Draggable/scrub  | B: `<TimelineBar>`                                             | tick math                                 |
| CantonHighlight / place focus                |                                          | A: `feature-state` + `easeTo`                                      |                                                  |                          | B: `<CantonShape>` on plate                                    | canton GeoJSON, palette                   |
| CityLabel                                    |                                          | A: symbol layer (collision)                                        |                                                  |                          | B: HTML/SVG on plate                                           | priority list, type tokens                |
| Layer rail, panels, legends, hover cards     | A                                        |                                                                    |                                                  | A: Motion transitions    |                                                                | tokens, scale legends                     |
| Web "Today" story                            | A: scroll-driven chapters                | A: camera targets per chapter                                      |                                                  | A: Motion scroll/enter   | not used                                                       | `StorySpec`, `CameraSpec`                 |
| "Switzerland Today" video, explainers        |                                          |                                                                    |                                                  |                          | B: compositions                                                | `StorySpec`, tokens, math, SVG primitives |
| Player embed                                 |                                          |                                                                    |                                                  |                          | B inside A on `/today`                                         | same composition code                     |

Decision rule per component: if it must react to the user or to live data continuously → A-side technology; if it must be reproducible frame-by-frame for an MP4 → Remotion; if both, share the math and tokens, not the renderer.

## 4. Website animation rules

- Data motion (particles, trains, flows, pulses) runs on `requestAnimationFrame` inside MapLibre/deck.gl/WebGL, pausable when the tab is hidden, and scrubbable through the timeline (time is an input, not a side effect).
- UI motion uses Motion for enter/exit/layout and GSAP for the scrubber and multi-step HUD sequences. No CSS keyframes for anything data-driven.
- Layer switches: 480 ms cross-dissolve of layer opacity plus a subtle camera settle; never a hard cut.
- Hover cards fade in 120 ms, follow the pointer with a spring, and show value · time · source.
- Reduced-motion preference: particles stop, flows become static dashes, pulses become rings without animation, all UI transitions shorten to 80 ms.

## 5. Remotion rules (from the official Remotion Agent Skills, installed at `.agents/skills`)

- Animate only with `useCurrentFrame()` + `interpolate()` / `spring()`; no CSS transitions, no Tailwind animation classes, no Motion/GSAP.
- Fonts via `@remotion/google-fonts` (`loadFont` at module top level); sequences with `<Sequence>` / `<TransitionSeries>`; media via `@remotion/media`; images via `<CanvasImage>`.
- `calculateMetadata()` loads the `StorySpec` (fixture file locally; `story/{date}.json` from Blob in CI) and derives `durationInFrames` from chapter `durationHint`s; randomness via `random(seed)`.
- **Maps — fixed map plate** (Remotion maps skill, `render-stability.md`): create the MapLibre map once with `interactive: false`, `fadeDuration: 0`, `canvasContextAttributes: { preserveDrawingBuffer: true }`, in an oversized container (≤ 4 096 px per side; 3 840 × 2 160 for landscape 1080p, ~2 700 × 3 840 for vertical) centred on the midpoint of the camera route; wait for `load` → `jumpTo` frame-0 camera → `idle` → `continueRender`; then **keep the renderer camera static** and move the whole canvas per frame with CSS `translate` + `scale` (scale ≤ 1); apply the same transform to projected overlays; animate GeoJSON data and paint properties imperatively. Per-frame `jumpTo` causes shimmer. Use `@turf/turf` for geometry; no `map.remove()` cleanup; render with `--gl=angle`, concurrency 1 while validating; split long camera moves into two plates with a deliberate cut rather than one giant canvas.
- Tiles for renders come from a local `.mbtiles`/PMTiles mirror of the swisstopo base tiles (or a small pre-fetched cache) so renders are deterministic and never rate-limited; attribution "© swisstopo" stays visible.
- Formats: 1080 × 1920 @ 30 fps primary (Shorts/Reels/TikTok), 1920 × 1080 secondary; 30–45 s; end card with all attributions.
- Chunk long compositions into scenes rendered separately if `angle` memory growth appears.

## 6. Where Remotion Player is (and is not) used

Used: `/today` shows the current `SwitzerlandToday` composition with live props (free under the Remotion free license for ≤ 3 people; previews are not renders). Not used: the live map, the HUD, layer transitions, the web story mode. If a future feature is a genuinely replayable, time-based explainer (e.g. "how the Föhn works"), it is a Remotion composition and may be embedded via Player.

## 7. Libraries

| Library                                                                                    | Version (Sept 2026)       | Licence                             | Use                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| maplibre-gl                                                                                | 5.24 (MVP) / 6.7 evaluate | BSD-3                               | live map; fixed plate in video                                      |
| @deck.gl/core, @deck.gl/layers, @deck.gl/maplibre                                          | 9.4                       | MIT                                 | point/path/animated layers via `MapLibreOverlay`                    |
| custom WebGL layer                                                                         | —                         | —                                   | wind/rain particles                                                 |
| motion                                                                                     | 13.2                      | MIT                                 | UI transitions                                                      |
| gsap                                                                                       | 3.15                      | free standard licence (all plugins) | scrubber, HUD choreography                                          |
| remotion, @remotion/player, @remotion/google-fonts, @remotion/media, @remotion/transitions | 4.0.5xx                   | Remotion license (free ≤ 3 people)  | video                                                               |
| @turf/turf                                                                                 | 7.4                       | MIT                                 | geometry, route slicing                                             |
| d3-scale, d3-geo, d3-array                                                                 | 4.x / 3.1                 | ISC                                 | scales, editorial projections                                       |
| proj4                                                                                      | 2.22                      | MIT                                 | LV95 ↔ WGS84                                                        |
| @observablehq/plot                                                                         | 0.6                       | ISC                                 | editorial charts (SSR to SVG for both targets)                      |
| deck.gl-particle (MPL-2.0) or weatherlayers-gl (MPL-2.0 / commercial)                      | —                         | see licence                         | optional reference for particle layers; prefer our own custom layer |

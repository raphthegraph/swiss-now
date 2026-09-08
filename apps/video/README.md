# @swiss-now/video

Remotion project for the story / video experience. Local rendering only in the MVP (Remotion free licence for individuals and teams ≤ 3). Follows the official Remotion Agent Skills installed at `.agents/skills`.

The compositions themselves live in [`packages/story-video`](../../packages/story-video) so the web app can mount the same code in a Remotion `<Player>` on `/today` without importing this app. This app registers them, keeps story fixtures and renders.

## Compositions

| Id                       | What                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SwitzerlandToday`       | "Switzerland Today", 1080 × 1920 (Shorts / Reels / TikTok). Title → the story's ranked chapters → credits over one fixed `swiss-now-light` map plate that jumps at each cut under a dip to paper. Chapter markers (temperature field, extremes, disruptions, river rings, quake rings) are SVG projected through the plate transform. ≈ 30–40 s. |
| `SwitzerlandTodayWide`   | The same composition at 1920 × 1080; the text column moves to the left and the camera target to the right.                                                                                                                                                                                                                                       |
| `SwitzerlandTodaySample` | A fixed story with every chapter type (energy arrows, hazard, events, a vote choropleth on the plate) for visual checks: `npx remotion still src/index.ts SwitzerlandTodaySample out/f.png --frame=790`. The vote plate needs `public/geo`, copied from the web app by the `copy-maplibre-worker` script.                                        |
| `SwissNowPlateSpike`     | Spike B (Phase 0): the map as a fixed plate, station circles coloured by the shared temperature scale, `Metric` primitive and legend from `@swiss-now/motion`. 3 s, 1920 × 1080.                                                                                                                                                                 |

Duration is data-driven: `calculateMetadata` sums the chapters' `durationHint`s (plus title and credits, minus the crossfades). See `storyTimeline()` in the package.

## Story input

The default props load `fixtures/story-<date>.json`, a saved `/api/story/today` response, so renders are deterministic and each day's story is archived next to its video. Two ways to get a fresh story:

```bash
pnpm --filter @swiss-now/video story:fetch                       # from the running web app on :3100 → fixtures/story-<date>.json
node_modules/.bin/tsx apps/web/scripts/story-from-snapshots.ts   # from the local snapshot files, no server needed (prints JSON)
```

To render the live story without a fixture, pass `storyUrl` as an input prop; `calculateMetadata` fetches and validates it:

```bash
pnpm --filter @swiss-now/video render -- SwitzerlandToday out/today.mp4 --props='{"storyUrl":"http://localhost:3100/api/story/today"}'
```

## Run

```bash
pnpm --filter @swiss-now/video studio           # preview (Remotion Studio)
pnpm --filter @swiss-now/video render:today     # → out/today.mp4 (vertical)
pnpm --filter @swiss-now/video render:today:wide
pnpm --filter @swiss-now/video still -- SwitzerlandToday out/frame.png --frame=150
```

`remotion.config.ts` sets `--gl=angle` and concurrency 1 (WebGL maps in headless Chromium; the map plate waits for `idle` before every captured cut). The MapLibre worker is copied to `public/map/vendor/` before studio/render. A full vertical render of a five-chapter story takes a few minutes on a laptop; `out/` is gitignored.

## Rules followed

- `useCurrentFrame()` + `interpolate()` only; no CSS transitions; deterministic randomness (`seededRandom`) for staggered markers.
- Fixed map plate per `render-stability.md`: renderer camera static within a sequence, CSS translate + scale for the push-in (scale ≤ 1, plate 2× the frame ≤ 4096 px per side).
- `<TransitionSeries>` with `fade()` between title, chapters and credits.
- Fonts via `@remotion/google-fonts/InterTight`; tokens, scales, envelopes and the `Metric` primitive from `@swiss-now/motion`.

# @swiss-now/video

Remotion project for the story / video experience. Local rendering only in the MVP (Remotion free licence for individuals and teams ≤ 3). Follows the official Remotion Agent Skills installed at `.agents/skills`.

## Compositions

| Id                   | What                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SwissNowPlateSpike` | Spike B: the `swiss-now-light` map as a fixed plate (static renderer camera, CSS translate/scale per frame), live-fixture station circles coloured by the shared temperature scale, `Metric` primitive and legend from `@swiss-now/motion`. 3 s, 1920×1080. |

## Run

```bash
pnpm --filter @swiss-now/video studio          # preview
pnpm --filter @swiss-now/video render SwissNowPlateSpike out/spike.mp4
pnpm --filter @swiss-now/video still SwissNowPlateSpike out/frame.png --frame=60
```

`remotion.config.ts` sets `--gl=angle` and concurrency 1 (WebGL maps in headless Chromium). The MapLibre worker is copied to `public/map/vendor/` before studio/render. Station data comes from `fixtures/` for deterministic renders; `calculateMetadata()` will fetch live `StorySpec`s in Phase 4.

# @swiss-now/motion

Shared visual and motion system for both rendering targets (interactive web, Remotion video).

- `tokens/` — colour (ground, daylight grounds, layer accents, scale stops), type, spacing, motion (durations, bezier easings), daylight thresholds, freshness styling, CSS-variable export.
- `scales/` — value → colour/size/speed mappings built from the token stops (d3-scale, Lab interpolation), shared legend ticks.
- `math/` — deterministic, clock-agnostic functions: seeded random, cubic-bezier easing, pulse/ring/flow envelopes, haversine paths, `positionAlongPath`, `positionAlongTrip`, sun altitude → daylight state.
- `svg/` — stateless React SVG primitives taking `progress ∈ [0,1]` (`Metric` first). Exported separately as `@swiss-now/motion/svg`.
- `specs/` — camera helpers shared by the web "Today" mode and the compositions.

Rule: no React-DOM, MapLibre, GSAP, Motion or Remotion imports in this package. See `docs/MOTION_SYSTEM.md`.

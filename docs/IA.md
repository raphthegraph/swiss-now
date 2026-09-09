# Information architecture

> Adopted 2026-09-08 (expansion plan). Category and visualization mode are independent: a topic is one subject with its sources, cadence and geography; a mode is one way of looking at it. Map-first, minimalist, Swiss modernism.

## Topics

Groups follow the time nature of the data, because that decides what TIMELINE means and which modes make sense.

```
NOW                  the composite of every topic's quiet presence (the home view, no instruments)
LIVE                 seconds–hours · points and rasters · timeline = 10-minute snapshots
  Weather · Water · Air · Hazards (quakes, avalanche, forest fire, hail, snow) · Events
SYSTEMS              seconds–minutes · networks and flows · timeline = snapshots
  Rail · Energy · Aviation (gated: no commercially clean source yet)
SWITZERLAND          months–years · municipality and canton polygons · timeline = vintages, votes, months
  Politics · Population · Housing · Economy · Tourism · Trade (charts-first)
```

The registry is code: `packages/core/src/topics/registry.ts` (`TopicSpec`: group, label, accent, layers, sources, cadence, geo level, supported modes, freshness kind, NOW presence, built). The rail shows built topics whose sources pass the licence policy; `modes` lists what is implemented today and grows stage by stage. Mountain passes have no open data and are not a topic.

## Modes

| Mode     | Meaning                                     | Instrument                                                                      |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| MAP      | geography at the selected time              | the map, legend, hover cards, figures                                           |
| TIMELINE | the map with a time cursor                  | radar scrubber (weather), vote scrubber (politics), snapshot scrubber (Stage 5) |
| CHARTS   | series and rankings, SVG in the house style | Stage 4                                                                         |
| COMPARE  | A                                           | B split of MAP or CHARTS: two places or two dates                               | Stage 5 |

Unsupported modes stay in the switcher, dimmed (`aria-disabled`), so it never jumps. Switching topic keeps the mode when supported, else MAP.

## View state in the URL

`/?topic=politics&mode=timeline&t=6860&place=261` — `topic`, `mode`, `t` (snapshot slot, vintage, month or vote id) and `place` (BFS number or canton code). Topic changes push a history entry; mode and time changes replace it. Parsing and serialization: `packages/core/src/topics/view.ts` (validated, falls back to defaults).

## Presence

Each layer renders `full` (the selected topic's own layers), `quiet` (a NOW contributor: energy arrows always, danger ≥ 2 stations, delayed trains, notable quakes, politics on a vote Sunday) or `off`. `presenceFor(topic, layer, ctx)` in core; `LiveMap` applies it to every `MapContribution` (`install` / `update` / `setPresence` / `hoverLayers`), and the page polls only layers that are on screen.

## Figures

`packages/core/src/topics/figures.ts` gives every topic its key figures (same shape as the story's chapter figures), consumed by the HUD strip today and by CHARTS, COMPARE and the video later.

## Licence policy

`packages/core/src/sources/policy.ts`: sources with `commercialUse: "yes"` render; `"unresolved"` sources render with a notice until confirmed (SED, the news feeds, Swissgrid); `"no"` and `"ask"` sources are blocked (adsb.fi, SNB, BAZG, the realtime vote feed). Substitutes: own boundaries from swissBOUNDARIES3D, Energy-Charts for prices and mix, ECB rates, Eurostat for trade, BFS + swissvotes for votes. Commercial-use requests to send are listed in the expansion plan.

## Geo spine

`apps/web/public/geo/ch-<vintage>.topo.json` (swissBOUNDARIES3D → TopoJSON, © swisstopo) and `municipalities-<vintage>.json` (BFS register). The BFS municipality number is the join key for every statistic; vintages change on 1 January.

## Status

Stage 1 (2026-09-08): registry, policy, URL state, rail groups, mode switcher, map contributions, HUD split, geo spine, Politics (latest federal votes per municipality with a vote timeline). Stage 2 (2026-09-08): live Energy (border-flow arrows, frequency, mix and price; the first CHARTS view), Events (geocoded police and SRF headlines as typographic markers). Stage 3 (2026-09-08): Air (Zürich UGZ, Sensor.Community citizen tier, pollen, short-term index) and Hazards (forest-fire and avalanche regions, IMIS snow, hail, quakes). Stage 4 (2026-09-08): Population, Housing, Economy and Tourism as quantile-scaled choropleths on the geo spine (BFS SDMX and PxWeb, KOF), CHARTS with rankings and national courses, TIMELINE over vintages and months. Trade waits for the Eurostat build. Stage 5 (2026-09-08): TIMELINE over the 48-hour snapshot store for NOW and the live topics (weather keeps its radar frames), COMPARE with a place search over the register (two municipalities or cantons: value, rank and change for statistics, yes share against the country for votes, nearest stations for weather and water), keyboard shortcuts. Stage 6 (2026-09-08): the story ranks energy, hazard, events, air and vote chapters; the video draws energy border arrows and a vote choropleth on the plate; Aviation is built behind the policy gate (451 from its route, no rail entry). Stage 7 (2026-09-08): the interface in de/fr/it/en (core `i18n`: `pick`, `t`, the shared figure-label table; story text written in four languages; the video takes a `lang` prop), short-viewport and mobile layout (the rail hangs below the modes on short screens, sits on the strip on phones, all four figures stay), taps open the cards, reduced motion honoured in the chrome and the canvas layers, `?` keyboard help, combobox semantics in the place search. Open: Trade (Eurostat), Basel air, the compare mini maps, on-device passes. Redesign (2026-09-09, docs/DESIGN.md): white top bar with the wordmark, a sidebar of icon topics, the map in the remaining cell with the mode switcher and zoom controls inside it, a bottom bar of figures with a source line each, the contour mark and the language switch; the same components stack into one column on phones. Depth stage D1 (2026-09-09, docs/DEPTH_PLAN.md): a place page under every municipality and canton (`/place/{bfs|canton}`) with weather, a 24-hour temperature history carried by the snapshots, the nearest gauge and air sensor, departures from our own trip state, events nearby, statistics with rank and the latest votes; reached by clicking a polygon, the top-bar search or the compare table.

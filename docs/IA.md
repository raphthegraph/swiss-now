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

Stage 1 (2026-09-08): registry, policy, URL state, rail groups, mode switcher, map contributions, HUD split, geo spine, Politics (latest federal votes per municipality with a vote timeline). Next stages: Energy + Events, Air + Hazards, Statistics + CHARTS, TIMELINE + COMPARE, story/video + gated Aviation, polish and languages.

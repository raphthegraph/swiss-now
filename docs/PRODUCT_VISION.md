# Swiss Now — Product Vision

> Planning document · v1 · 2026-09-07 · Status: proposal for review
> Companion docs: [DATA_SOURCES](DATA_SOURCES.md) · [ARCHITECTURE](ARCHITECTURE.md) · [FREE_TIER_ARCHITECTURE](FREE_TIER_ARCHITECTURE.md) · [MOTION_SYSTEM](MOTION_SYSTEM.md) · [MVP_PLAN](MVP_PLAN.md) · [OPEN_QUESTIONS](OPEN_QUESTIONS.md)

## 1. Concept

**Swiss Now is a living map of Switzerland.** Open it and the country is already moving: rain drifting over the Jura, trains sliding through the Gotthard, the Rhine rising at Basel after a storm, a tremor pulsing in Valais, the temperature field warming from Ticino northwards.

It is not a dashboard. It is closer to a data-journalism piece that never stops being current, a Bloomberg-style live feed rendered as cartography, and a piece of ambient digital art that happens to be useful every day.

One normalized data layer, the **Swiss Now State**, feeds two rendering targets:

- **A. The interactive web experience** — full-screen MapLibre map with animated data layers, a typographic HUD, a timeline and a web-native "Today" story mode.
- **B. The Remotion story / video experience** — choreographed, time-based compositions ("Switzerland Today — 7 September 2026") that share the same data contracts and design tokens and can be rendered to MP4 for Shorts, Reels and TikTok.

```
Swiss open data  →  adapters  →  SwissNowState  →  shared visual & motion system  →  A. web  |  B. video
```

## 2. Why people would come back

A visualization demo earns one visit; a product earns a habit. Habits attach to _moments_. Swiss Now must answer a concrete question in under five seconds at each of these moments, without any interaction beyond opening the page:

| Job to be done                         | Moment                                   | What the default view must answer                                                         |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| "What is it like out there right now?" | Morning, before leaving                  | Temperature and rain **where I am**; where it is snowing or raining right now             |
| "Is my commute broken?"                | 06:30–08:30, 16:30–18:30                 | Delays on my rail line; disruptions; later: motorway congestion                           |
| "Something is happening"               | After a storm, a quake, a flood headline | Where, how big, is it still going, how unusual                                            |
| "Is the weekend plan on?"              | Thursday–Friday                          | Snow depth, lake temperature, river levels; in winter avalanche danger; later pass status |
| "Show me Switzerland"                  | Any time; sharing                        | The ambient default view — the thing people screenshot and send                           |
| "What happened today?"                 | Evening                                  | The auto-assembled "Today" story (and, later, the video)                                  |

Design implications that follow directly:

1. **The default view is already useful without interaction.** The NOW composite and the summary strip carry the answers above the fold.
2. **One personalisation lever, no account.** A home canton or city stored in the browser makes the summary strip about _your_ Switzerland. Nothing else is personal.
3. **Commute hours look different.** Between 06:30–08:30 and 16:30–18:30 the RAIL layer is promoted in the NOW composite and the strip leads with punctuality.
4. **Events surface themselves.** Flood danger level ≥ 3, a felt earthquake, a 24-hour rainfall record, a national on-time percentage below 80 % — anomalies are ranked automatically and pulled into the composite and the story.
5. **Honesty builds trust and repeat visits.** Every value carries a timestamp and a source; stale data visibly ages; interpolated train positions are labelled as interpolated, never presented as GPS.

## 3. Target users

| Segment                                     | Role               | Frequency            | What they need                                           |
| ------------------------------------------- | ------------------ | -------------------- | -------------------------------------------------------- |
| Swiss residents and commuters               | Primary            | Daily, several times | Local weather now, rail delays, "is something happening" |
| Outdoor and weekend planners                | Primary (seasonal) | Weekly               | Snow, lakes, rivers, avalanche danger, passes            |
| Swiss-curious: diaspora, tourists, students | Secondary          | Occasional           | The beautiful ambient view, the story                    |
| Journalists, data and design community      | Amplifiers         | Event-driven         | Shareable views, credible sources, the daily video       |

Languages: the data model carries DE/FR/IT/EN names and labels from day one. MVP UI copy ships in **EN and DE**; FR and IT follow.

## 4. Product principles

1. **The map is the hero.** UI recedes into a typographic HUD at the edges. No card grids, no sidebar of widgets.
2. **Motion is information.** Everything that moves encodes a real quantity: rate, direction, magnitude, age. Nothing animates for decoration.
3. **Honest data.** Timestamp and source on every value; freshness states (`live`, `aging`, `stale`, `outage`) change the rendering; interpolation and derivation are always labelled.
4. **Swiss modernism.** Grid, strong typography, restrained colour on a near-monochrome ground with relief. One accent colour per layer. Light/dark follows the actual daylight state in Switzerland.
5. **One data model, two renderers.** `SwissNowState` and the shared motion system drive both web and video. Rendering technology is chosen per component for the best result, not forced through one engine.
6. **Respect the sources.** Server-side ingestion only, cadence-matched polling, visible attribution for every provider, no redistribution where terms forbid it.
7. **Free until it matters.** The MVP runs entirely on free tiers and open data; paid infrastructure is introduced only when traffic or commercial use forces it (see FREE_TIER_ARCHITECTURE).

## 5. The experience as built

Rewritten 2026-09-08 after the expansion (docs/IA.md). Sections 5.1–5.8 describe what ships; the
original proposal is in the git history.

### 5.1 The stage

A full-bleed MapLibre map on swisstopo's vector basemap, restyled to a quiet monochrome ground with
hillshade. Switzerland is the frame, the neighbours are dimmed, the camera rests on the whole
country and glides only when a place is chosen. Data is drawn in the house palette on top of it:
fields and rasters behind, polygons in the middle, points, arrows and typographic markers in front.

### 5.2 Topics and modes

Two independent choices, both in the URL (`?topic=…&mode=…&t=…&place=…`):

```
NOW                                       the composite (home)
LIVE         WEATHER · WATER · AIR · HAZARDS · EVENTS
SYSTEMS      RAIL · ENERGY · (AVIATION, gated)
SWITZERLAND  POLITICS · POPULATION · HOUSING · ECONOMY · TOURISM · (TRADE, planned)

MAP · CHARTS · TIMELINE · COMPARE          top right of the canvas
```

The rail is typographic, grouped by the time nature of the data (seconds to hours, networks and
flows, months to years). A topic that has nothing to show right now (no quake above M 2, no
avalanche bulletin in summer) is still listed but rendered quiet. The mode switcher never changes
shape: a mode a topic cannot offer is dimmed, not removed. Switching topic keeps the mode when the
new topic supports it. Keyboard: `[` `]` topics, `1`–`4` modes, `Esc` home, `/` place search.

### 5.3 NOW, the composite

Curated, not everything at once. Each topic declares a quiet presence and the composite shows the
union: temperature field and radar where it rains, sparse wind, trains as faint marks with delay
pulses, flood danger from level 2, quake rings for 24 hours, energy border arrows, forest-fire
regions from danger level 4 at low opacity, high-confidence events as small typographic marks,
and on a vote Sunday the country's yes share. Nothing else: no legends, no instruments, no
per-station values. The masthead carries the clock and freshness, the figure strip four national
figures (warmest, coldest, Rhine at Basel, net export, or the local equivalents once a home place
is set).

### 5.4 Topic views

- **LIVE.** Weather (station values, wind particles, the 5-minute radar with its scrubber,
  extremes), Water (discharge-scaled rivers, lake levels, danger levels), Air (a short-term index on
  the reference stations, citizen sensors hollow, pollen), Hazards (forest fire and avalanche
  regions, snow stations, radar hail, quakes), Events (police communiqués and SRF headlines
  geocoded to municipalities with a confidence, headline and link only).
- **SYSTEMS.** Rail (interpolated trains, honestly labelled, delays, disruptions, on-time index),
  Energy (four border arrows whose width and dash speed follow the megawatts, grid frequency,
  production mix and price in CHARTS). Aviation is built but hidden until a commercially clean feed
  exists.
- **SWITZERLAND.** Politics (yes share per municipality for the latest federal votes, the calendar
  of coming vote Sundays), Population, Housing, Economy and Tourism as quantile-scaled choropleths on
  the municipality and canton geometry, each with CHARTS (rankings and national courses).

### 5.5 Modes

- **MAP** shows geography at the selected time.
- **CHARTS** shows rankings and series in the house style (Observable Plot, paper and ink,
  hairlines), never a dashboard grid.
- **TIMELINE** is MAP with a time cursor: 10-minute snapshots for the live topics (48 hours), radar
  frames for weather, vote dates and vintages for the statistics. It returned after being dropped
  from the MVP because the expanded data gives it something to scrub; it stays a mode, never a
  permanent instrument on the map.
- **COMPARE** puts two places side by side with the same figures (value, rank, change for a
  statistic; yes share against the country for a vote; nearest stations for weather and water).

### 5.6 Place focus

A home place (municipality or canton, stored locally, no account) makes the figure strip local and
sets the camera. The place search reads the municipality register and falls back to the swisstopo
gazetteer. In COMPARE the second place comes from the same search.

### 5.7 Today, the story

`/today` assembles chapters from the day's snapshots: weather summary, extremes, rainfall, delays,
rivers, quakes, energy flows, hazards, events, air and, after a vote Sunday, the vote. Scrolling
moves the map beneath the text. The same story renders as the vertical "Switzerland Today" video in
Remotion with the chapter markers drawn on a fixed map plate, and plays on the page.

### 5.8 Micro-interactions and honesty

Hover reveals value, time and source in a small typographic card. Nothing pops in; everything fades
or slides on a shared timing scale, and the reduced-motion preference stops the ambient motion.
Freshness is visible: aging values desaturate, stale layers dim with a "last update" tag, outages
show a calm notice. Interpolated positions are labelled as such; the one deliberate departure is the
RAIL view, where trains run on an accelerated display clock so the country-scale view moves — the
legend says so in red and a switch restores real speed (docs/DESIGN.md). Every source is named in the strip
and the credits, and a source that cannot be used commercially is not shown at all.

## 6. What it must not be

- A generic SaaS dashboard: no card grids, no excessive rounded cards, no purple gradients, no glassmorphism, no default-Tailwind look.
- A slideshow of videos: Remotion never drives the live map or the HUD.
- A false-precision toy: no GPS claims for interpolated trains, no unofficial "warnings" dressed as official ones.
- A one-time demo: every phase must add to a daily reason to return (see MVP_PLAN).

## 7. Success signals for the MVP

- Returning visitors in the 06:30–08:30 window (commute value).
- Median time to first useful information under 5 seconds on a mid-range phone.
- Share rate of the default view and the Today story.
- Zero infrastructure cost until the Vercel Hobby fair-use threshold is approached (see FREE_TIER_ARCHITECTURE).

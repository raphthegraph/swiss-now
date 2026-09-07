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

## 5. Proposed experience

### 5.1 The stage

A full-bleed MapLibre map on swisstopo's vector base map, restyled to a quiet monochrome ground with vector hillshade. Switzerland is the frame; neighbouring countries are dimmed. The camera rests on the whole country; it glides, never jumps.

The environmental state is derived from sun altitude over Bern: dawn, day, dusk and night grounds. At night the map darkens and lights of data (stations, trains) become the primary luminance.

### 5.2 Layer rail

A vertical typographic rail (no icon-only buttons):

```
NOW
WEATHER
TRAFFIC        (Phase 5)
RAIL
WATER
AIR            (Phase 5, city-scale)
ENERGY         (Phase 5, daily)
QUAKES         (appears only when an event occurred in the last 30 days)
```

Selecting a layer _reduces_ the composite to that system and unlocks its detail: legend, national ranking ("warmest: Magadino 27.1°, coldest: Jungfraujoch −3.4°"), hover on stations/segments, layer-specific timeline.

### 5.3 NOW — the default composite

Curated, not everything at once. Visible by default:

- Temperature colour field, subtle, behind everything.
- Live precipitation radar, only where it is raining (transparent elsewhere).
- Wind particles, sparse, speed-scaled; density increases with wind.
- Rail delay pulses only where delay exceeds a threshold; trains as faint moving marks; promoted in commute hours.
- Flood danger only for stations at level ≥ 2.
- Earthquake ring if an event occurred in the last 24 hours.
- **Summary strip** (top or bottom edge): "Switzerland · 21:07 · 14.2° in Zürich · raining over 18 % of the country · 91 % of trains on time · Rhine at Basel 1 010 m³/s, normal · last quake M1.5 Bourg-Saint-Pierre, 11:21"

Hidden by default: station labels, legends, per-station values, traffic counters, energy flows.

### 5.4 Layer views (MVP)

- **WEATHER** — temperature field with station values on hover; wind particles at full density; precipitation radar with the last 3 hours scrubbable; extremes ranking; snow depth where present.
- **WATER** — rivers drawn with animated flow whose speed encodes discharge relative to normal; lake levels; water temperature; flood danger stations pulsing by level; national flood warning polygons when active.
- **RAIL** — the rail network drawn; trains moving along their routes **interpolated** from schedule and live delay (rendered as soft marks, distinct from any "reported position" style); delay pulses sized by minutes late; disruptions as text cards anchored to lines; national on-time index with baseline from yesterday.
- **QUAKES** — expanding rings sized by magnitude, fading over hours; list of the last 30 days.

### 5.5 Place focus

Click a canton or city (or set your home place): the camera glides in, the summary strip becomes local, rankings recompute for the region, and the layer rail's detail follows. Stored in `localStorage`; no account.

### 5.6 Timeline

`NOW ← 1h ← 3h ← 6h ← 12h ← TODAY`, a GSAP-driven scrubber. Backed by 10-minute snapshots. Scrubbing animates the field (temperature warms, rain moves, rivers rise) rather than swapping numbers. Only layers with snapshot history expose it.

### 5.7 Today — the story mode

A web-native, scroll-driven sequence of chapters assembled automatically from ranked anomalies and superlatives: weather summary, hottest and coldest place, biggest rainfall, worst delay, unusual river or flood condition, earthquake if any, one statistic of the day. Each chapter moves the map camera and highlights the relevant layer. The same `StorySpec` drives the Remotion composition, so the video is the story rendered on a clock instead of a scroll.

### 5.8 Micro-interactions

Hover reveals value, time and source in a small typographic card. Nothing pops in; everything fades or slides on a shared timing scale. Freshness is visible: aging values desaturate, stale layers dim with a "last update 14:20" tag, outages show a calm notice, never a red error.

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

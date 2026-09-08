# Design

Direction set on 2026-09-08 from the owner's mockups: a quiet paper map framed by white bars, one
sidebar of topics with outline icons, graphite type, and two warm accents. The wordmark and the
contour mark carry the brand; everything else is data.

## Palette

| Token             | Hex       | Use                                                            |
| ----------------- | --------- | -------------------------------------------------------------- |
| `ground.paper`    | `#FAFAF8` | page and map ground                                            |
| `ground.surface`  | `#FFFFFF` | top bar, sidebar, bottom bar, cards, sheets                    |
| `ground.ink`      | `#111827` | type, icons, the contour mark                                  |
| `ground.graphite` | `#64748B` | secondary type, labels, inactive topics                        |
| `ground.mist`     | `#E5E7EB` | hairlines, dividers, disabled                                  |
| `brand.swissRed`  | `#E2563D` | the live dot, active underline, temperature extremes, delays   |
| `brand.amber`     | `#F5A623` | energy flows, warm middle of the temperature ramp, aging state |
| `layerAccent.*`   | see code  | one accent per layer, cool and muted, used for information     |

Freshness: live `#2E9E5B`, aging amber, stale Swiss red, outage delay red. Tokens live in
`packages/motion/src/tokens/color.ts` and reach the web app as `--sn-*` custom properties; the
video reads the same objects. The basemap fork (`packages/geo-build/scripts/fork-basemap-style.mjs`)
uses the paper value as its background.

## Type

Inter for the interface (400/500/600), loaded through `next/font` on the web and
`@remotion/google-fonts` in the video. Labels are 12 px uppercase with 0.12 em tracking; figures
are 28 px semibold with tabular figures; the unit sits at half size in graphite. The wordmark is
the only place Montserrat appears: `SWISS` bold, `NOW` light, 0.08 em tracking
(`components/brand/Wordmark.tsx`).

## The mark

`components/brand/Mark.tsx` draws Switzerland's real border as six nested contour lines that
shrink towards a red dot near the country's centre. The path data is generated from the geo spine
by `packages/geo-build/scripts/build-mark.mjs` (cantons merged, simplified, smoothed, then scaled
towards the focus point so the rings never cross) into `apps/web/lib/brand/mark.ts`,
`public/brand/mark.svg` and the favicon `app/icon.svg`. Re-run the script when the boundary
vintage changes.

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ SWISS NOW │ home place                     Switzerland · 23:20 · ● LIVE │ top bar, 56 px
├───────────┼──────────────────────────────────────────────────────┤
│ JETZT     │ map                         MAP · CHARTS · TIMELINE · … │
│  ● LIVE   │                                                    [+] │
│ LIVE      │                                                    [−] │
│  Wetter … │                                                    [◎] │ sidebar 216 px
│ SYSTEME   │                                                        │
│  Bahn …   │ ┌ legend / timeline card ┐                              │
│ SCHWEIZ   ├──────────────────────────────────────────────────────┤
│  Politik …│ figure │ figure │ figure │ figure │ mark │ DE FR IT EN ⓘ │ bottom bar
└───────────┴──────────────────────────────────────────────────────┘
```

- **Top bar**: wordmark, a hairline, the home-place control, the country clock with freshness.
- **Sidebar**: the NOW group (red bar, a `LIVE` item with a red dot), then LIVE, SYSTEMS and
  SWITZERLAND separated by hairlines. One Lucide outline icon per topic
  (`components/brand/topic-icons.tsx`); the active item is a light grey pill.
- **Map**: fills the remaining cell. The mode switcher sits top right on a translucent pill (active
  mode underlined in Swiss red); zoom and locate are white squares below it; legends and timeline
  scrubbers float in one white card at the bottom left and disappear under the CHARTS and COMPARE
  sheets.
- **Bottom bar**: one cell per key figure (label, value, place, source line), the contour mark, the
  language switch and an info button that opens the sources sheet with every attribution of the
  view and the status link.
- **Cards**: white, 1 px mist border, 12 px radius, one soft shadow (`shadow.card`). Hover cards
  keep a 3 px left accent in the layer colour.

## Phones (≤ 767 px)

The same components in one column: top bar (48 px, no home control), map, the topic row
(horizontal scroll, groups separated by hairlines, icons kept), the figure row (compact cells,
horizontal scroll, sources hidden) and a thin tools row (languages, info). The mode switcher becomes
a full-width pill at the top of the map; zoom and locate shrink to 36 px. The bottom takes about
a fifth of the screen. A tap opens the card a hover would; a tap on open water closes it.

## Motion and access

Unchanged from `MOTION_SYSTEM.md`: transitions on the shared timing scale, reduced motion honoured
in the chrome and the canvas layers, keyboard shortcuts (`[` `]` `1`–`4` `Esc` `/` `?`), combobox
semantics in the place search. Contrast: graphite on white 5.5:1, ink on paper 16:1; mist is used
for hairlines and disabled controls only.

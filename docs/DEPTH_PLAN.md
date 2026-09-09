# Depth plan

Status: APPROVED 2026-09-09 (owner). Basis: the shipped app (docs/IA.md), the owner's topic-by-topic
wishes, and a live verification of every source below on 2026-09-09. The rule from the expansion
plan holds: commercially clean sources only; anything else is listed under "needs permission".

## The two threads

**Depth** means that every click leads somewhere: a place page under every municipality and
canton, history and context behind every figure, and each topic carrying more than one indicator.

**Interactivity** is not a phase: every feature below ships with its motion — charts that draw
themselves when a sheet opens, figures that count up when they change, choropleths that sweep in,
routes that light up on hover, the camera flying to a chosen place. Reduced motion switches all of
it off.

## Stages

Each stage is one to two sessions, one commit per step, CI green, docs updated, QA extended.

### Stage D1 — Place page and history (in progress)

- `/place/{bfs|canton}`: weather now with every parameter of the nearest station, a 24-hour
  temperature sparkline, the nearest river gauge, the nearest air sensor with its index, the next
  departures through the stops within reach (from our own trip state, no extra API), events of the
  last day nearby, the statistics with rank in the canton, and how the place voted on the latest
  Sunday against the country.
- History without a database: every 10-minute snapshot carries a rolling 24-hour digest (one
  temperature per station and slot), so the newest snapshot alone gives a day of history. Later
  digests add wind, rain and discharge.
- Ways in: clicking a municipality or canton polygon, a search in the top bar, the compare table,
  a hint on the hover card. Fix shipped in the same step: stacked choropleths now hover the
  polygon that carries a value (the population hover bug).

### Stage D2 — Energy sites, hazard context, national air

| Topic   | Source (verified)                                                                                                              | Licence                                                                        | What ships                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Energy  | SFOE production plants, STAC `ch.bfe.elektrizitaetsproduktionsanlagen` (CSV 39 MB, 333 k plants, monthly)                      | opendata.swiss terms_by                                                        | plants ≥ 1 MW (~1 500) by type and capacity on the map; the hourly national mix makes each type breathe with its share |
| Energy  | WASTA hydro statistics, STAC `ch.bfe.statistik-wasserkraftanlagen` (728 plants, turbine power, expected production)            | terms_by                                                                       | hover cards for hydro plants                                                                                           |
| Energy  | Grid > 36 kV, geodienste WFS `elektrische_anlagen_ueber_36kv_v1_0_0` (lines, masts, stations; no login)                        | terms_by                                                                       | the high-voltage grid as hairlines                                                                                     |
| Energy  | Reservoir filling, `bfe-ogd.ch/ogd17/ogd17_fuellungsgrad_speicherseen.csv` (weekly since 2000)                                 | terms_by                                                                       | a filling gauge per region with the seasonal curve in CHARTS                                                           |
| Air     | NABEL stations, `ch.bafu.nabelstationen` (16 stations) + hourly CSV export from the BAFU query app (no key; undocumented)      | stations terms_by; export unlicensed federal data, attribution "Quelle: NABEL" | national reference coverage; PM2.5/O₃/NO₂ surface interpolated from reference + citizen sensors, ozone in summer       |
| Hazards | forest fire, avalanche, hail, quakes as today; MeteoSwiss weather warnings are **not** open data (checked all OGD collections) | —                                                                              | a warnings panel stays on the permission list (below)                                                                  |

### Stage D3 — Events as "everything unusual right now"

One ranked feed with a list beside the map: police and SRF headlines (today), SBB disruptions,
quakes above M 2, forest-fire level 4+, hail, high-danger river gauges; a 24-hour density strip;
category filters; clustering at national zoom. Road incidents join once the FEDRO token exists
(below). Sources are all already in the registry except FEDRO.

### Stage D4 — Rail depth and elections

- Rail: route highlight with next stops on hover, the ten worst trains now, punctuality per line
  over the day, and history from the daily archives (opentransportdata Istdaten, open). Station
  boards on the place page come from our own trip state; the OJP stationboard (free token, same
  account, commercial OK, 20 000 requests a day) is the upgrade if more detail is wanted.
- Politics: National Council results 1971–2023 per municipality from PxWeb `px-x-1702020000_105`
  (one POST per year returns all municipalities × 25 parties, 893 KB): party strength over time,
  seat shifts, a place's political profile; the language divide per vote as a chart.

### Stage D5 — Statistics with history

Population: age structure, nationality, growth since 2010, density (BFS STATPOP). Housing: new
dwellings, vacancy history. Economy: jobs by sector (STATENT sectors), cantonal GDP; cantonal
unemployment is **not** available machine-readable (amstat is a dashboard, SECO publishes PDFs)
and stays on the wish list. Tourism: nights by origin country, the seasonal curve, occupancy
(HESTA). All through the existing weekly `build-data` job; each topic gets an indicator picker and
history in CHARTS and on the place page.

### Stage D6 — Alerts and daily return

Home place plus thresholds (river danger, line delays, air index, warnings) with browser push
through a small worker, no accounts. Depends on D1 (the place) and D2 (the data).

## Needs permission or a token (owner's list)

| Source                                                                              | Unlocks                            | Status                                                                     |
| ----------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| Alertswiss alerts JSON (`polyalert.alertswiss_alerts.actual.json`, 22 active today) | civil-protection alerts on HAZARDS | CC BY-NC-SA 2.5 CH: non-commercial; ask BABS for permission                |
| FEDRO traffic situations (DATEX II via opentransportdata.swiss)                     | road incidents in EVENTS           | free registration, commercial OK with attribution; needs a token in Vercel |
| OJP stationboard (opentransportdata.swiss)                                          | richer departure boards            | free token, separate API key                                               |
| MeteoSwiss weather warnings                                                         | official warnings on HAZARDS       | not open data; ask MeteoSwiss                                              |
| SECO cantonal unemployment                                                          | economy history                    | no machine-readable source; ask SECO or scrape the PDF                     |
| transport.opendata.ch                                                               | fallback stationboard              | search.ch quota and terms, no commercial guarantee; not used               |

## Verification

Per stage as before: typecheck, tests with fixtures per new parser, the production build under
software WebGL (`qa-rail-hover.mjs`, `qa-i18n.mjs`), screenshots (`qa-shots.mjs`), and the
Hobby budgets (Blob operations, function CPU) checked in the Vercel dashboard after a week.

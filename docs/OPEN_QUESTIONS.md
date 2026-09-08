# Swiss Now — Open Questions

> Planning document · v1 · 2026-09-07 · Items to verify or decide before or during implementation. Owner and target phase in brackets.

## 1. Legal and licensing

- [ ] **SED earthquake catalogue** — the FDSN service is open (no key, no registration) and is used as-is for the non-commercial MVP with attribution. The disclaimer permits private, scientific and non-commercial use; written clarification is needed only **before any commercial use**. Parked until then. [pre-commercial]
- [ ] **FEDRO traffic data** — confirm the 260 000-call quota reset process, TDP-partner status requirements, whether alpine pass closures are reliably included in situations, and the exact meaning of "no raw redistribution" for derived congestion indices. Contact `verkehrsdaten-plattform@astra.admin.ch`. [P1, for P5]
- [ ] **SFOE `terms_by_ask` datasets** (production mix, consumption, spot price) — request permission for commercial use; until then use only `terms_by` files. [P4]
- [ ] **ENTSO-E** — token requires an email request; per the "freely accessible only" rule this stays out of scope until Phase 5 is revisited. Reuse terms and CH generation-per-type completeness still to verify then. [P5]
- [ ] **Alplakes** — data licence and attribution (code is MIT, data terms unstated); availability expectations. Contact `james.runnalls@eawag.ch`. [P4]
- [ ] **Zürich OGD** — CKAN shows `license_title: null` for UGZ datasets; confirm terms. [P4]
- [ ] **Font licence** for the chosen grotesk (OFL vs commercial). [P0]
- [ ] **Vercel Hobby fair use** — define the moment the project stops being "personal, non-commercial" (sponsorship, ads, company ownership) → Pro. [ongoing]
- [ ] **Remotion 5.0** licence changes and Player status; team headcount trajectory (free ≤ 3 people). [P4]
- [ ] **MeteoSwiss pictograms** are proprietary — design our own symbol set mapped from symbol numbers. [P3]

## 2. Data verification

- [ ] Is the geo.admin `messwerte` / `hydroweb` GeoJSON family a supported contract or an internal artefact of map.geo.admin.ch? Ask via `docs.geo.admin.ch` contact; keep OGD CSVs as fallback. [P1]
- [ ] `ch.swisstopo.leichte-basiskarte.vt` returns NoSuchKey for its tile source today — transient or permanent? Re-test; build on `lightbasemap.vt`. [P0]
- [ ] FSDI numeric request-limit table did not render — fetch it or ask. [P0]
- [ ] LINDAS hydro: semantics of `isLiter` (L/s vs m³/s), meaning of `Draft` status, and the danger-level legend in machine-readable form. [P1]
- [ ] True GTFS-RT rate limit (cookbook 2/min vs limits page 5/min). Design for 2/min. [P2]
- [ ] Which train operators/route types are reliably present in TripUpdates; coverage of BLS/SOB/RhB. [P2]
- [~] Route paths: SBB lines + BAV network merged and endpoint-stitched → 17.2 % straight-line legs on patterns in service (was 32 %). Remaining causes: 141 Swiss stops with no track node within 800 m (stop coordinates far from the mapped centreline, or lines missing in the 2021 BAV file) and foreign sections. Possible next steps: per-stop snap tolerance, a newer BAV release, OSM railways as a last resort. [P3]
- [x] Rail payload: 1.86 MB uncompressed gzips to 164 KB (measured 2026-09-08); the Vercel CDN compresses responses, so no compact wire format is needed for the MVP. Revisit only if the 60-s poll shows up in bandwidth metrics. [P2]
- [~] Rail files hosting: the loader reads from `RAIL_DATA_URL` (an HTTP base such as a Vercel Blob store) when set, else `public/rail/`; the Actions job uploads to Blob when `BLOB_READ_WRITE_TOKEN` is configured. Creating the store and the secret is a deployment task (needs a Vercel project). [deploy]
- [ ] Radar: feasibility of decoding ODIM HDF5 with `h5wasm` in a Node function; CPU cost; colour scale for RZC (mm/h) vs CPC (mm/h accumulated). [P1]
- [ ] MeteoSwiss degraded-cadence behaviour (the June 2026 incident) — how freshness should present a 60-min cadence. [P1]
- [ ] SLF avalanche bulletin publication times (17:00 / 08:00) and the exact warning-region geometry endpoint. [P3]
- [ ] opendata.swiss / CKAN user-agent blocking policy for automated access. [P2]
- [ ] Whether any official machine-readable weather-warning feed appears (roadmap says nothing). [ongoing]
- [ ] Whether SED offers an automatic (unreviewed) event feed with lower latency. [P3]

## 3. Free-tier verification

- [ ] Exact **Vercel Blob Hobby** included quotas (storage, simple/advanced operations, data transfer); the pricing pages fetched list only Pro examples. Check the dashboard after creating the store. [P0]
- [x] Supabase not needed for the MVP: snapshots and the story are JSON files (local dir / Vercel Blob) and daily aggregates can be derived from them. Revisit only for multi-month baselines. [P3]
- [ ] Measured edge requests and fast data transfer per visitor-hour (model assumes 80–110 requests, ~4 MB). [P1]
- [ ] Measured active CPU of one GTFS-RT TripUpdates parse in a Vercel function (model assumes ~0.3 s). [P2]
- [ ] GitHub Actions: public vs private repository decision (unlimited minutes vs 2 000/month) and the 60-day inactivity auto-disable handling. [P0]

## 4. Product and design decisions

- [x] MapLibre 5.24 vs 6.x → **6.7 chosen** (deck.gl 9.4 supports it; worker and no-WebGL2 issues fixed). See `docs/SPIKES.md`. [P0]
- [x] Laptop frame rate: 60 fps, min 60 (2026-09-07). [P0]
- [ ] Phone frame rate (mid-range device, `?fps=1` via LAN); target ≥ 30 fps. [P1]
- [ ] Typeface and final palette; behaviour of the daylight-driven environmental state (automatic vs user toggle). [P0]
- [ ] MVP UI languages: EN + DE proposed; FR/IT timing. [P1]
- [ ] Thresholds for the NOW composite (when does a delay pulse, a danger level, a rain cell earn a place by default). [P1]
- [ ] Commute-hour promotion rules and how "home place" influences the summary strip. [P1]
- [~] Story ranking heuristics implemented (weather summary always; extremes, rainfall, gust/snow, rail, river, quake by score). Copy is templated English; DE/FR/IT and any AI copywriting remain open (default: no AI). [P3]
- [ ] Video formats and lengths for each platform; end-card attribution layout. [P4]
- [ ] Product name and domain availability (swissnow.ch / .swiss / .app). [P0]

## 5. Deferred architecture questions

- [ ] When to introduce automated nightly rendering (GitHub Actions vs Vercel Sandbox) and social posting. [after MVP]
- [ ] Whether to self-host swisstopo base tiles as PMTiles for the website (not only for renders) as traffic approaches the 20 000 users/day fair-use ceiling. [scale]
- [ ] Multi-region functions and a shared hot cache (Upstash) if non-Swiss traffic becomes significant. [scale]
- [ ] Raw observation warehouse (Postgres partitions) if analyses beyond daily aggregates are wanted. [scale]

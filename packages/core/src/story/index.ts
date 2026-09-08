/**
 * Story builder: ranks the day's anomalies from its snapshots into a StorySpec that drives both
 * the web "Today" mode and the Remotion composition (docs/PRODUCT_VISION.md §5.7).
 * Heuristic scores 0–1 per chapter; chapters below `minScore` are cut; the summary always leads.
 */
import type { Snapshot } from "../snapshot/index";
import type { Chapter, StorySpec } from "../state/story";
import type { LonLat } from "../state/common";
import type { Event, Observation, Station } from "../state/entities";

export const SWITZERLAND_CENTER: LonLat = [8.2275, 46.8182];
const NATIONAL = { center: SWITZERLAND_CENTER, zoom: 7.2, bearing: 0, pitch: 0 } as const;

export interface BuildStoryOptions {
  /** local date `YYYY-MM-DD` the story is about */
  date: string;
  now: Date;
  minScore?: number;
  maxChapters?: number;
}

const fmt = (v: number, d = 1) => v.toFixed(d).replace(/\.0$/, "");

function stationById(snap: Snapshot | undefined, id: string): Station | undefined {
  return (
    snap?.weather?.stations.find((s) => s.id === id) ??
    snap?.hydrology?.stations.find((s) => s.id === id)
  );
}
function name(snap: Snapshot | undefined, id: string): string {
  const s = stationById(snap, id);
  return s?.name.en ?? s?.name.de ?? id;
}
function camera(lonLat: LonLat | undefined, zoom = 9): Chapter["camera"] {
  return lonLat ? { center: lonLat, zoom, bearing: 0, pitch: 0 } : { ...NATIONAL };
}
function latestObs(snap: Snapshot | undefined, parameter: Observation["parameter"]): Observation[] {
  const obs = snap?.weather?.observations.filter((o) => o.parameter === parameter) ?? [];
  const byStation = new Map<string, Observation>();
  for (const o of obs)
    if (!byStation.has(o.stationId) || o.observedAt > byStation.get(o.stationId)!.observedAt)
      byStation.set(o.stationId, o);
  return [...byStation.values()];
}

export function buildStory(snapshots: Snapshot[], opts: BuildStoryOptions): StorySpec {
  const sorted = [...snapshots].sort((a, b) => (a.at < b.at ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  const chapters: Chapter[] = [];
  const credits = new Set<string>();
  const minScore = opts.minScore ?? 0.2;

  // 1. weather summary (always present when weather exists)
  const w = latest?.weather;
  if (w) {
    credits.add("Source: MeteoSwiss");
    const warm = w.extremes.warmest;
    const cold = w.extremes.coldest;
    const rain = w.rainingAreaShare ?? w.rainingShare ?? 0;
    const dayMax = Math.max(...sorted.map((s) => s.weather?.extremes.warmest?.value ?? -99));
    const text =
      warm && cold
        ? `${fmt(warm.value)}° in ${name(latest, warm.stationId)}, ${fmt(cold.value)}° on ${name(latest, cold.stationId)}${rain >= 0.05 ? `, rain over ${Math.round(rain * 100)} % of the country` : rain > 0 ? ", a few showers" : ", dry everywhere"}`
        : "Switzerland right now";
    chapters.push({
      id: "weather-summary",
      type: "weather-summary",
      layer: "weather",
      headline: { de: text, en: text },
      body: {
        de: `Peak of the day so far: ${fmt(dayMax)}°`,
        en: `Peak of the day so far: ${fmt(dayMax)}°`,
      },
      highlights: [warm?.stationId, cold?.stationId].filter((x): x is string => Boolean(x)),
      data: { warmest: warm, coldest: cold, rainingShare: rain, stations: w.stations.length },
      camera: { ...NATIONAL },
      durationHint: 6,
      score: 1,
    });
    // 2. extremes
    if (warm && cold) {
      const spread = warm.value - cold.value;
      chapters.push({
        id: "extremes",
        type: "extremes",
        layer: "weather",
        headline: {
          de: `${fmt(spread, 0)} degrees between ${name(latest, warm.stationId)} and ${name(latest, cold.stationId)}`,
          en: `${fmt(spread, 0)} degrees between ${name(latest, warm.stationId)} and ${name(latest, cold.stationId)}`,
        },
        highlights: [warm.stationId, cold.stationId],
        data: { warmest: warm, coldest: cold, spread },
        camera: camera(stationById(latest, warm.stationId)?.lonLat, 8.5),
        durationHint: 6,
        score: Math.min(1, spread / 30),
      });
    }
    // 3. rainfall (wettest 24 h)
    const wet = w.extremes.wettest24h;
    if (wet && wet.value >= 3) {
      chapters.push({
        id: "rainfall",
        type: "rainfall",
        layer: "weather",
        headline: {
          de: `${fmt(wet.value, 0)} mm of rain in ${name(latest, wet.stationId)} in 24 hours`,
          en: `${fmt(wet.value, 0)} mm of rain in ${name(latest, wet.stationId)} in 24 hours`,
        },
        highlights: [wet.stationId],
        data: { wettest24h: wet, rainingShare: rain },
        camera: camera(stationById(latest, wet.stationId)?.lonLat, 8.5),
        durationHint: 5,
        score: Math.min(1, wet.value / 40),
      });
    }
    // 7. statistic of the day: gust or snow
    const gust = w.extremes.windiestGust;
    const snow = w.extremes.deepestSnow;
    if (gust && gust.value >= 50) {
      chapters.push({
        id: "stat-gust",
        type: "stat",
        layer: "weather",
        headline: {
          de: `Gusts of ${fmt(gust.value, 0)} km/h on ${name(latest, gust.stationId)}`,
          en: `Gusts of ${fmt(gust.value, 0)} km/h on ${name(latest, gust.stationId)}`,
        },
        highlights: [gust.stationId],
        data: { gust },
        camera: camera(stationById(latest, gust.stationId)?.lonLat, 8.5),
        durationHint: 5,
        score: Math.min(1, gust.value / 120),
      });
    } else if (snow && snow.value >= 20) {
      chapters.push({
        id: "stat-snow",
        type: "snow",
        layer: "weather",
        headline: {
          de: `${fmt(snow.value, 0)} cm of snow on ${name(latest, snow.stationId)}`,
          en: `${fmt(snow.value, 0)} cm of snow on ${name(latest, snow.stationId)}`,
        },
        highlights: [snow.stationId],
        data: { snow },
        camera: camera(stationById(latest, snow.stationId)?.lonLat, 8.5),
        durationHint: 5,
        score: Math.min(1, snow.value / 150),
      });
    }
  }

  // 4. rail: worst punctuality of the day and largest delay
  const rails = sorted.map((s) => s.rail).filter((r): r is NonNullable<typeof r> => Boolean(r));
  if (rails.length) {
    credits.add("Source: opentransportdata.swiss");
    const onTime = rails.map((r) => r.onTimeIndex).filter((v): v is number => v !== undefined);
    const worstOnTime = onTime.length ? Math.min(...onTime) : undefined;
    let worst: (typeof rails)[number]["worst"][number] | undefined;
    for (const r of rails)
      for (const x of r.worst) if (!worst || x.delaySeconds > worst.delaySeconds) worst = x;
    const disruptions = rails[rails.length - 1]!.disruptions;
    const headline = worst
      ? `${worst.line}${worst.headsign ? ` to ${worst.headsign}` : ""} was ${Math.round(worst.delaySeconds / 60)} minutes late${worstOnTime !== undefined ? ` · ${Math.round(worstOnTime * 100)} % of trains on time at the worst moment` : ""}`
      : worstOnTime !== undefined
        ? `${Math.round(worstOnTime * 100)} % of trains on time at the worst moment`
        : "Trains ran on time";
    const dis = disruptions[0];
    const disCam =
      dis && dis.geometry.type === "LineString"
        ? dis.geometry.coordinates[0]
        : dis && dis.geometry.type === "Point"
          ? dis.geometry.coordinates
          : undefined;
    chapters.push({
      id: "rail",
      type: "rail",
      layer: "rail",
      headline: { de: headline, en: headline },
      body: disruptions.length
        ? { de: dis!.headline.de, en: dis!.headline.en ?? dis!.headline.de }
        : undefined,
      highlights: [],
      data: {
        worstOnTime,
        worst,
        disruptions: disruptions.length,
        running: rails[rails.length - 1]!.running,
      },
      camera: camera(disCam as LonLat | undefined, 8.5),
      durationHint: 6,
      score: Math.min(
        1,
        (worst ? worst.delaySeconds / 3600 : 0) +
          (worstOnTime !== undefined ? Math.max(0, 0.9 - worstOnTime) : 0) +
          disruptions.length * 0.15,
      ),
    } as Chapter);
  }

  // 5. river: highest danger level, else largest river by discharge
  const h = latest?.hydrology;
  if (h) {
    credits.add("Source: FOEN");
    const danger = Object.entries(h.dangerLevels).sort((a, b) => b[1] - a[1])[0];
    // discharge without a water level comes from secondary computation stations (diversions, sometimes
    // reported in l/s without a unit marker) — rankings use gauged main stations only
    const withLevel = new Set(
      h.observations.filter((o) => o.parameter === "waterLevel").map((o) => o.stationId),
    );
    const q = h.observations
      .filter((o) => o.parameter === "discharge" && withLevel.has(o.stationId))
      .sort((a, b) => b.value - a.value)[0];
    const st =
      danger && danger[1] >= 2
        ? h.stations.find((s) => s.id === danger[0])
        : q
          ? h.stations.find((s) => s.id === q.stationId)
          : undefined;
    if (st) {
      const isDanger = Boolean(danger && danger[1] >= 2);
      const headline = isDanger
        ? `Flood danger level ${danger![1]} on the ${st.waterBody ?? "river"} at ${st.name.de}`
        : `${st.waterBody ?? "River"} at ${st.name.de}: ${fmt(q!.value, 0)} m³/s, the largest flow in the country`;
      chapters.push({
        id: "river",
        type: "river",
        layer: "hydrology",
        headline: { de: headline, en: headline },
        highlights: [st.id],
        data: {
          stationId: st.id,
          dangerLevel: isDanger ? danger![1] : undefined,
          discharge: q?.value,
        },
        camera: camera(st.lonLat, 9),
        durationHint: 5,
        score: isDanger ? Math.min(1, 0.4 + danger![1] * 0.15) : 0.25,
      });
    }
  }

  // 6. quake: strongest in the last 24 h (M ≥ 2), else the strongest of the last 7 days if M ≥ 2.5
  const q = latest?.seismic;
  if (q) {
    const nowMs = opts.now.getTime();
    const recent = (days: number): Event[] =>
      q.events.filter((e) => nowMs - new Date(e.startsAt).getTime() < days * 86_400_000);
    const pick = (evs: Event[]) =>
      evs.reduce<Event | undefined>(
        (b, e) => (!b || (e.magnitude ?? 0) > (b.magnitude ?? 0) ? e : b),
        undefined,
      );
    const day = pick(recent(1));
    const week = pick(recent(7));
    const chosen =
      day && (day.magnitude ?? 0) >= 2
        ? day
        : week && (week.magnitude ?? 0) >= 2.5
          ? week
          : undefined;
    if (chosen && chosen.geometry.type === "Point") {
      credits.add("Source: Swiss Seismological Service (SED) at ETH Zurich");
      chapters.push({
        id: "quake",
        type: "quake",
        layer: "seismic",
        headline: { de: chosen.headline.de, en: chosen.headline.en ?? chosen.headline.de },
        highlights: [chosen.id],
        data: { event: chosen },
        camera: camera(chosen.geometry.coordinates, 9.5),
        durationHint: 5,
        score: Math.min(1, ((chosen.magnitude ?? 0) - 1.5) / 3),
      });
    }
  }

  credits.add("© swisstopo");
  const [summary, ...rest] = chapters;
  const ranked = rest
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, (opts.maxChapters ?? 6) - 1);
  const final = summary ? [summary, ...ranked] : ranked;
  return {
    schemaVersion: 1,
    date: opts.date,
    generatedAt: opts.now.toISOString(),
    title: { de: `Die Schweiz heute — ${opts.date}`, en: `Switzerland today — ${opts.date}` },
    chapters: final.length ? final : [placeholder(opts.date)],
    credits: [...credits],
  };
}

function placeholder(date: string): Chapter {
  return {
    id: "empty",
    type: "stat",
    layer: "weather",
    headline: { de: "Noch keine Daten für heute", en: "No data for today yet" },
    highlights: [],
    data: { date },
    camera: { ...NATIONAL },
    durationHint: 4,
    score: 0,
  };
}

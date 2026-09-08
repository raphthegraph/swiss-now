/**
 * Story builder: ranks the day's anomalies from its snapshots into a StorySpec that drives both
 * the web "Today" mode and the Remotion composition (docs/PRODUCT_VISION.md §5.7).
 * Heuristic scores 0–1 per chapter; chapters below `minScore` are cut; the summary always leads.
 */
import { EVENT_CATEGORY, FL, pick, t, type UiLang } from "../i18n";
import type { LocalizedText } from "../state/common";
import type { Snapshot } from "../snapshot/index";
import type { Chapter, StoryMarker, StorySpec } from "../state/story";
import type { LonLat } from "../state/common";
import type { Event, Observation, Station } from "../state/entities";
import type { PoliticsState } from "../state/politics";

export const SWITZERLAND_CENTER: LonLat = [8.2275, 46.8182];
const NATIONAL = { center: SWITZERLAND_CENTER, zoom: 7.2, bearing: 0, pitch: 0 } as const;

export interface BuildStoryOptions {
  /** local date `YYYY-MM-DD` the story is about */
  date: string;
  now: Date;
  minScore?: number;
  maxChapters?: number;
  /** the politics state: a vote Sunday within the last week becomes a chapter */
  politics?: PoliticsState | undefined;
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
function marker(
  snap: Snapshot | undefined,
  kind: StoryMarker["kind"],
  stationId: string,
  extra: Partial<Omit<StoryMarker, "id" | "kind" | "lonLat">> = {},
): StoryMarker | undefined {
  const st = stationById(snap, stationId);
  if (!st) return undefined;
  const m: StoryMarker = {
    id: stationId,
    kind,
    lonLat: st.lonLat,
    label: name(snap, stationId),
    emphasis: false,
  };
  if (extra.value !== undefined) m.value = extra.value;
  if (extra.unit !== undefined) m.unit = extra.unit;
  if (extra.emphasis !== undefined) m.emphasis = extra.emphasis;
  if (extra.label !== undefined) m.label = extra.label;
  return m;
}
const defined = <T>(xs: (T | undefined)[]): T[] => xs.filter((x): x is T => x !== undefined);

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
    const pct = Math.round(rain * 100);
    const tail =
      rain >= 0.05
        ? t(
            `, Regen über ${pct} % des Landes`,
            `, rain over ${pct} % of the country`,
            `, pluie sur ${pct} % du pays`,
            `, pioggia sul ${pct} % del Paese`,
          )
        : rain > 0
          ? t(", vereinzelt Schauer", ", a few showers", ", quelques averses", ", qualche rovescio")
          : t(", überall trocken", ", dry everywhere", ", sec partout", ", asciutto ovunque");
    const summaryHeadline: LocalizedText =
      warm && cold
        ? (() => {
            const wn = name(latest, warm.stationId);
            const cn = name(latest, cold.stationId);
            const wv = fmt(warm.value);
            const cv = fmt(cold.value);
            return t(
              `${wv}° in ${wn}, ${cv}° auf ${cn}${tail.de}`,
              `${wv}° in ${wn}, ${cv}° on ${cn}${tail.en}`,
              `${wv}° à ${wn}, ${cv}° à ${cn}${tail.fr}`,
              `${wv}° a ${wn}, ${cv}° a ${cn}${tail.it}`,
            );
          })()
        : t(
            "Die Schweiz jetzt",
            "Switzerland right now",
            "La Suisse maintenant",
            "La Svizzera adesso",
          );
    chapters.push({
      id: "weather-summary",
      type: "weather-summary",
      layer: "weather",
      headline: summaryHeadline,
      body: {
        de: `Tageshöchstwert bisher: ${fmt(dayMax)}°`,
        en: `Peak of the day so far: ${fmt(dayMax)}°`,
        fr: `Maximum du jour jusqu'ici : ${fmt(dayMax)}°`,
        it: `Massima del giorno finora: ${fmt(dayMax)}°`,
      },
      highlights: [warm?.stationId, cold?.stationId].filter((x): x is string => Boolean(x)),
      data: { warmest: warm, coldest: cold, rainingShare: rain, stations: w.stations.length },
      markers: defined(
        latestObs(latest, "airTemperature").map((o) =>
          marker(latest, "temperature", o.stationId, {
            value: o.value,
            unit: "°",
            emphasis: o.stationId === warm?.stationId || o.stationId === cold?.stationId,
          }),
        ),
      ),
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
          de: `${fmt(spread, 0)} Grad zwischen ${name(latest, warm.stationId)} und ${name(latest, cold.stationId)}`,
          en: `${fmt(spread, 0)} degrees between ${name(latest, warm.stationId)} and ${name(latest, cold.stationId)}`,
          fr: `${fmt(spread, 0)} degrés entre ${name(latest, warm.stationId)} et ${name(latest, cold.stationId)}`,
          it: `${fmt(spread, 0)} gradi tra ${name(latest, warm.stationId)} e ${name(latest, cold.stationId)}`,
        },
        highlights: [warm.stationId, cold.stationId],
        data: { warmest: warm, coldest: cold, spread },
        markers: defined([
          marker(latest, "temperature", warm.stationId, {
            value: warm.value,
            unit: "°",
            emphasis: true,
          }),
          marker(latest, "temperature", cold.stationId, {
            value: cold.value,
            unit: "°",
            emphasis: true,
          }),
        ]),
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
          de: `${fmt(wet.value, 0)} mm Regen in ${name(latest, wet.stationId)} in 24 Stunden`,
          en: `${fmt(wet.value, 0)} mm of rain in ${name(latest, wet.stationId)} in 24 hours`,
          fr: `${fmt(wet.value, 0)} mm de pluie à ${name(latest, wet.stationId)} en 24 heures`,
          it: `${fmt(wet.value, 0)} mm di pioggia a ${name(latest, wet.stationId)} in 24 ore`,
        },
        highlights: [wet.stationId],
        data: { wettest24h: wet, rainingShare: rain },
        markers: defined([
          marker(latest, "rain", wet.stationId, { value: wet.value, unit: "mm", emphasis: true }),
        ]),
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
          de: `Böen von ${fmt(gust.value, 0)} km/h auf ${name(latest, gust.stationId)}`,
          en: `Gusts of ${fmt(gust.value, 0)} km/h on ${name(latest, gust.stationId)}`,
          fr: `Rafales de ${fmt(gust.value, 0)} km/h à ${name(latest, gust.stationId)}`,
          it: `Raffiche di ${fmt(gust.value, 0)} km/h a ${name(latest, gust.stationId)}`,
        },
        highlights: [gust.stationId],
        data: { gust },
        markers: defined([
          marker(latest, "gust", gust.stationId, {
            value: gust.value,
            unit: "km/h",
            emphasis: true,
          }),
        ]),
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
          de: `${fmt(snow.value, 0)} cm Schnee auf ${name(latest, snow.stationId)}`,
          en: `${fmt(snow.value, 0)} cm of snow on ${name(latest, snow.stationId)}`,
          fr: `${fmt(snow.value, 0)} cm de neige à ${name(latest, snow.stationId)}`,
          it: `${fmt(snow.value, 0)} cm di neve a ${name(latest, snow.stationId)}`,
        },
        highlights: [snow.stationId],
        data: { snow },
        markers: defined([
          marker(latest, "snow", snow.stationId, { value: snow.value, unit: "cm", emphasis: true }),
        ]),
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
    const pctOnTime = worstOnTime !== undefined ? Math.round(worstOnTime * 100) : undefined;
    const onTimeText =
      pctOnTime !== undefined
        ? t(
            `${pctOnTime} % der Züge pünktlich im schlechtesten Moment`,
            `${pctOnTime} % of trains on time at the worst moment`,
            `${pctOnTime} % des trains à l'heure au pire moment`,
            `${pctOnTime} % dei treni in orario nel momento peggiore`,
          )
        : undefined;
    const headline: LocalizedText = worst
      ? (() => {
          const min = Math.round(worst.delaySeconds / 60);
          const h = worst.headsign;
          const sep = onTimeText ? " · " : "";
          return t(
            `${worst.line}${h ? ` nach ${h}` : ""} hatte ${min} Minuten Verspätung${sep}${onTimeText?.de ?? ""}`,
            `${worst.line}${h ? ` to ${h}` : ""} was ${min} minutes late${sep}${onTimeText?.en ?? ""}`,
            `${worst.line}${h ? ` vers ${h}` : ""} avait ${min} minutes de retard${sep}${onTimeText?.fr ?? ""}`,
            `${worst.line}${h ? ` per ${h}` : ""} aveva ${min} minuti di ritardo${sep}${onTimeText?.it ?? ""}`,
          );
        })()
      : (onTimeText ??
        t(
          "Die Züge fuhren pünktlich",
          "Trains ran on time",
          "Les trains étaient à l'heure",
          "I treni erano in orario",
        ));
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
      headline,
      body: disruptions.length ? dis!.headline : undefined,
      highlights: [],
      data: {
        worstOnTime,
        worst,
        disruptions: disruptions.length,
        running: rails[rails.length - 1]!.running,
      },
      markers: disruptions.slice(0, 3).flatMap((d): StoryMarker[] => {
        const at =
          d.geometry.type === "LineString"
            ? (d.geometry.coordinates[0] as LonLat | undefined)
            : d.geometry.type === "Point"
              ? (d.geometry.coordinates as LonLat)
              : undefined;
        return at
          ? [
              {
                id: d.id,
                kind: "disruption",
                lonLat: at,
                label: d.headline.en ?? d.headline.de,
                emphasis: true,
              },
            ]
          : [];
      }),
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
      const wb = st.waterBody;
      const nm = st.name.de;
      const headline: LocalizedText = isDanger
        ? t(
            `Hochwassergefahr Stufe ${danger![1]}: ${wb ?? "Fluss"} bei ${nm}`,
            `Flood danger level ${danger![1]} on the ${wb ?? "river"} at ${nm}`,
            `Danger de crue niveau ${danger![1]} : ${wb ?? "rivière"} à ${nm}`,
            `Pericolo di piena grado ${danger![1]}: ${wb ?? "fiume"} a ${nm}`,
          )
        : t(
            `${wb ?? "Fluss"} bei ${nm}: ${fmt(q!.value, 0)} m³/s, der grösste Abfluss des Landes`,
            `${wb ?? "River"} at ${nm}: ${fmt(q!.value, 0)} m³/s, the largest flow in the country`,
            `${wb ?? "Rivière"} à ${nm} : ${fmt(q!.value, 0)} m³/s, le plus grand débit du pays`,
            `${wb ?? "Fiume"} a ${nm}: ${fmt(q!.value, 0)} m³/s, il deflusso maggiore del Paese`,
          );
      chapters.push({
        id: "river",
        type: "river",
        layer: "hydrology",
        headline,
        highlights: [st.id],
        data: {
          stationId: st.id,
          dangerLevel: isDanger ? danger![1] : undefined,
          discharge: q?.value,
        },
        markers: [
          {
            id: st.id,
            kind: "river",
            lonLat: st.lonLat,
            label: `${st.waterBody ?? ""} ${st.name.de}`.trim(),
            ...(q ? { value: q.value, unit: "m³/s" } : {}),
            emphasis: true,
          },
        ],
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
        headline: chosen.headline,
        highlights: [chosen.id],
        data: { event: chosen },
        markers: [
          {
            id: chosen.id,
            kind: "quake",
            lonLat: chosen.geometry.coordinates,
            label: chosen.headline.en ?? chosen.headline.de,
            ...(chosen.magnitude !== undefined ? { value: chosen.magnitude, unit: "M" } : {}),
            emphasis: true,
          },
        ],
        camera: camera(chosen.geometry.coordinates, 9.5),
        durationHint: 5,
        score: Math.min(1, ((chosen.magnitude ?? 0) - 1.5) / 3),
      });
    }
  }

  // 7. energy: the day's largest net import or export, with the price of that hour
  const energies = sorted
    .map((s) => s.energy)
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  if (energies.length) {
    credits.add("Source: Swissgrid");
    credits.add("Source: Energy-Charts.info (Fraunhofer ISE)");
    const peak = energies.reduce<(typeof energies)[number] | undefined>(
      (b, e) =>
        e.netImportMW !== undefined &&
        (!b || Math.abs(e.netImportMW) > Math.abs(b.netImportMW ?? 0))
          ? e
          : b,
      undefined,
    );
    if (peak?.netImportMW !== undefined) {
      const imp = peak.netImportMW >= 0;
      const mw = Math.round(Math.abs(peak.netImportMW));
      const at = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Zurich",
      }).format(new Date(peak.observedAt));
      const price =
        peak.priceEurPerMWh !== undefined ? ` · ${Math.round(peak.priceEurPerMWh)} €/MWh` : "";
      const headline = t(
        `Die Schweiz ${imp ? "importierte" : "exportierte"} ${mw} MW um ${at}${price}`,
        `Switzerland ${imp ? "imported" : "exported"} ${mw} MW at ${at}${price}`,
        `La Suisse ${imp ? "importait" : "exportait"} ${mw} MW à ${at}${price}`,
        `La Svizzera ${imp ? "importava" : "esportava"} ${mw} MW alle ${at}${price}`,
      );
      chapters.push({
        id: "energy",
        type: "energy",
        layer: "energy",
        headline,
        highlights: [],
        markers: [],
        data: {
          netImportMW: peak.netImportMW,
          priceEurPerMWh: peak.priceEurPerMWh,
          frequencyHz: peak.frequencyHz,
          renewableSharePct: peak.renewableSharePct,
          borderFlows: peak.borderFlows,
        },
        camera: { ...NATIONAL },
        durationHint: 5,
        score: Math.min(1, mw / 4000),
      });
    }
  }

  // 8. events: a busy day on the police and news feeds
  const ev = latest?.events;
  if (ev && ev.count >= 10) {
    credits.add("Source: polizei.news");
    credits.add("Source: SRF");
    const top = Object.entries(ev.byCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
    const catText = (lang: UiLang) =>
      top.length
        ? ` · ${top
            .map(([c, n]) => {
              const cat = (EVENT_CATEGORY as Record<string, { many: LocalizedText }>)[c];
              return `${n} ${cat ? pick(cat.many, lang) : c}`;
            })
            .join(", ")}`
        : "";
    const headline = t(
      `${ev.count} Ereignisse in 24 Stunden${catText("de")}`,
      `${ev.count} events in 24 hours${catText("en")}`,
      `${ev.count} événements en 24 heures${catText("fr")}`,
      `${ev.count} eventi in 24 ore${catText("it")}`,
    );
    chapters.push({
      id: "events",
      type: "events",
      layer: "events",
      headline,
      body: {
        de: `${ev.placed} mit hoher Sicherheit auf der Karte verortet`,
        en: `${ev.placed} placed on the map with high confidence`,
        fr: `${ev.placed} localisés sur la carte avec une confiance élevée`,
        it: `${ev.placed} localizzati sulla carta con alta affidabilità`,
      },
      highlights: [],
      markers: [],
      data: { count: ev.count, placed: ev.placed, byCategory: ev.byCategory },
      camera: { ...NATIONAL },
      durationHint: 5,
      score: Math.min(1, ev.count / 60),
    });
  }

  // 9. hazards: forest-fire danger at level 4 or more, or hail
  const hz = latest?.hazards;
  if (hz && ((hz.fireMaxLevel ?? 0) >= 4 || hz.hail)) {
    credits.add("Source: FOEN");
    if (hz.hail) credits.add("Source: MeteoSwiss");
    const level = hz.fireMaxLevel ?? 0;
    const n = hz.fireRegionsAt3Plus;
    const headline =
      level >= 4
        ? t(
            `Waldbrandgefahr Stufe ${level} in ${n} Regionen${hz.hail ? " · Hagel erkannt" : ""}`,
            `Forest-fire danger level ${level} in ${n} regions${hz.hail ? " · hail detected" : ""}`,
            `Danger d'incendie de forêt niveau ${level} dans ${n} régions${hz.hail ? " · grêle détectée" : ""}`,
            `Pericolo d'incendio grado ${level} in ${n} regioni${hz.hail ? " · grandine rilevata" : ""}`,
          )
        : t(
            "Hagel im Radar erkannt",
            "Hail detected by the radar",
            "Grêle détectée par le radar",
            "Grandine rilevata dal radar",
          );
    chapters.push({
      id: "hazard",
      type: "hazard",
      layer: "hazards",
      headline,
      highlights: [],
      markers: [],
      data: {
        fireMaxLevel: hz.fireMaxLevel,
        fireRegionsAt3Plus: hz.fireRegionsAt3Plus,
        hail: hz.hail,
      },
      camera: { ...NATIONAL },
      durationHint: 5,
      score: Math.min(1, 0.3 + level * 0.15 + (hz.hail ? 0.2 : 0)),
    });
  }

  // 10. air: a poor hour at a reference station
  const air = latest?.air;
  if (air?.worstIndex !== undefined && air.worstIndex >= 4) {
    credits.add("Source: Stadt Zürich UGZ");
    const headline = t(
      `Luftqualitätsindex ${air.worstIndex} in Zürich`,
      `Air quality index ${air.worstIndex} in Zürich`,
      `Indice de qualité de l'air ${air.worstIndex} à Zurich`,
      `Indice di qualità dell'aria ${air.worstIndex} a Zurigo`,
    );
    chapters.push({
      id: "air",
      type: "air",
      layer: "air",
      headline,
      highlights: [],
      markers: [],
      data: {
        worstIndex: air.worstIndex,
        referenceStations: air.referenceStations,
        citizenSensors: air.citizenSensors,
      },
      camera: { center: [8.54, 47.38], zoom: 10, bearing: 0, pitch: 0 },
      durationHint: 5,
      score: Math.min(1, (air.worstIndex - 2) / 4),
    });
  }

  // 11. vote: a federal vote Sunday within the last week
  const vote = opts.politics?.latest[0];
  if (
    vote &&
    opts.now.getTime() - new Date(`${vote.meta.date}T12:00:00+02:00`).getTime() < 7 * 86_400_000
  ) {
    credits.add("Source: BFS");
    credits.add("Source: swissvotes.ch");
    const yes = vote.national.yesPct;
    const accepted = vote.meta.national?.accepted;
    const voteLine = (lang: UiLang, pending: string, yesWord: string, acc: string, rej: string) => {
      const title = pick(vote.meta.title, lang);
      return yes === null
        ? `${pending}${title}`
        : `${accepted === undefined ? "" : accepted ? acc : rej}${title} · ${yes.toFixed(1)} ${yesWord}`;
    };
    const headline = t(
      voteLine("de", "Abstimmungssonntag: ", "% Ja", "Angenommen: ", "Abgelehnt: "),
      voteLine("en", "Vote Sunday: ", "% yes", "Accepted: ", "Rejected: "),
      voteLine("fr", "Votation : ", "% de oui", "Acceptée : ", "Refusée : "),
      voteLine("it", "Votazione: ", "% di sì", "Accettata: ", "Respinta: "),
    );
    const byMunicipality: Record<string, number> = {};
    for (const [k, v] of Object.entries(vote.byMunicipality))
      if (v.yesPct !== null) byMunicipality[k] = v.yesPct;
    chapters.push({
      id: `vote-${vote.meta.id}`,
      type: "vote",
      layer: "politics",
      headline,
      highlights: [],
      markers: [],
      data: {
        yesPct: yes,
        turnoutPct: vote.national.turnoutPct,
        accepted,
        byMunicipality,
        voteId: vote.meta.id,
      },
      camera: { ...NATIONAL },
      durationHint: 7,
      score: 0.9,
    });
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
    title: t(
      `Die Schweiz heute — ${opts.date}`,
      `Switzerland today — ${opts.date}`,
      `La Suisse aujourd'hui — ${opts.date}`,
      `La Svizzera oggi — ${opts.date}`,
    ),
    chapters: final.length ? final : [placeholder(opts.date)],
    credits: [...credits],
  };
}

function placeholder(date: string): Chapter {
  return {
    id: "empty",
    type: "stat",
    layer: "weather",
    headline: t(
      "Noch keine Daten für heute",
      "No data for today yet",
      "Pas encore de données pour aujourd'hui",
      "Ancora nessun dato per oggi",
    ),
    highlights: [],
    markers: [],
    data: { date },
    camera: { ...NATIONAL },
    durationHint: 4,
    score: 0,
  };
}

/** A key figure a chapter renderer shows next to the headline; formatting is the renderer's job. */
export interface ChapterFigure {
  label: LocalizedText;
  value: number;
  decimals: number;
  unit?: string;
}

/**
 * Key figures per chapter type, read from `chapter.data`. Shared by the web Today mode and the
 * video so both show the same numbers with the same labels.
 */
export function chapterFigures(c: Chapter): ChapterFigure[] {
  const d = (c.data ?? {}) as Record<string, unknown>;
  const num = (k: string): number | undefined =>
    typeof d[k] === "number" ? (d[k] as number) : undefined;
  const obs = (k: string): number | undefined => {
    const o = d[k] as { value?: unknown } | undefined;
    return typeof o?.value === "number" ? o.value : undefined;
  };
  const out: ChapterFigure[] = [];
  const push = (
    label: LocalizedText,
    value: number | undefined,
    decimals: number,
    unit?: string,
  ) => {
    if (value === undefined) return;
    out.push(unit ? { label, value, decimals, unit } : { label, value, decimals });
  };
  switch (c.type) {
    case "weather-summary":
    case "extremes": {
      push(FL.warmest, obs("warmest"), 1, "°C");
      push(FL.coldest, obs("coldest"), 1, "°C");
      const share = num("rainingShare");
      if (share !== undefined && c.type === "weather-summary")
        push(FL.rainingOver, share * 100, 0, "%");
      break;
    }
    case "rainfall":
      push(FL.rain24h, obs("wettest24h"), 0, "mm");
      break;
    case "rail": {
      const w = num("worstOnTime");
      push(FL.lowestOnTime, w === undefined ? undefined : w * 100, 0, "%");
      const worst = d["worst"] as { delaySeconds?: unknown } | undefined;
      push(
        FL.largestDelay,
        typeof worst?.delaySeconds === "number" ? worst.delaySeconds / 60 : undefined,
        0,
        "min",
      );
      push(FL.trainsNow, num("running"), 0);
      break;
    }
    case "river":
      push(FL.discharge, num("discharge"), 0, "m³/s");
      push(FL.dangerLevel, num("dangerLevel"), 0);
      break;
    case "quake": {
      const e = d["event"] as { magnitude?: unknown; depthKm?: unknown } | undefined;
      push(FL.magnitude, typeof e?.magnitude === "number" ? e.magnitude : undefined, 1);
      push(FL.depth, typeof e?.depthKm === "number" ? e.depthKm : undefined, 0, "km");
      break;
    }
    case "energy": {
      const net = num("netImportMW");
      push(
        net !== undefined && net < 0 ? FL.netExport : FL.netImport,
        net === undefined ? undefined : Math.abs(net),
        0,
        "MW",
      );
      push(FL.price, num("priceEurPerMWh"), 0, "€/MWh");
      push(FL.renewable, num("renewableSharePct"), 0, "%");
      break;
    }
    case "stat":
      push(FL.gust, obs("gust"), 0, "km/h");
      break;
    case "events":
      push(FL.events24h, num("count"), 0);
      push(FL.placed, num("placed"), 0);
      break;
    case "hazard":
      push(FL.fireDangerShort, num("fireMaxLevel"), 0);
      push(FL.regions3, num("fireRegionsAt3Plus"), 0);
      break;
    case "air":
      push(FL.airIndex, num("worstIndex"), 0);
      push(FL.citizenSensors, num("citizenSensors"), 0);
      break;
    case "vote":
      push(FL.yes, num("yesPct"), 1, "%");
      push(FL.turnout, num("turnoutPct"), 1, "%");
      break;
    case "snow":
      push(FL.snowDepth, obs("snow"), 0, "cm");
      break;
    default:
      break;
  }
  return out;
}

/**
 * Key figures per topic — the shared figure model for the HUD strip, charts and compare views
 * (same shape as the story's `ChapterFigure`, so the video can reuse them). Formatting is the
 * renderer's job; `text` carries values that are not numbers (e.g. `M2.5`).
 */
import type { HydrologyState, RailState, SeismicState, WeatherState } from "../state/layers";
import type { PoliticsState, VoteResult } from "../state/politics";
import type { EnergyState } from "../state/layers";
import type { EventsState } from "../state/events";
import type { AirState } from "../state/layers";
import type { HazardsState } from "../state/hazards";
import { latestValues, type IndicatorSeries } from "../state/stats";
import { currentDelay } from "../data-sources/transit/rail-state";
import type { TopicId } from "./spec";
import type { LocalizedText } from "../state/common";
import { FL, t, withSuffix } from "../i18n";
import { SOURCES } from "../sources/registry";
import type { SourceId } from "../sources/ids";

export interface Figure {
  id: string;
  label: LocalizedText;
  value: number;
  decimals: number;
  unit?: string;
  /** Display text overriding the number (renderer shows it verbatim). */
  text?: string;
  /** Secondary line: place, source, qualifier. */
  where?: string;
  /** Attribution line ("Source: MeteoSwiss"), from the source registry. */
  source?: string;
}

export interface TopicStates {
  weather?: WeatherState | undefined;
  hydrology?: HydrologyState | undefined;
  rail?: RailState | undefined;
  seismic?: SeismicState | undefined;
  politics?: PoliticsState | undefined;
  energy?: EnergyState | undefined;
  events?: EventsState | undefined;
  air?: AirState | undefined;
  hazards?: HazardsState | undefined;
  /** the statistics topic's indicator on the map, its selected period and a name lookup */
  stats?:
    | { series: IndicatorSeries; period?: string | undefined; nameOf: (key: string) => string }
    | undefined;
  /** the vote currently shown (latest or the timeline selection) */
  vote?: VoteResult | undefined;
}

const fig = (
  id: string,
  label: LocalizedText,
  value: number,
  decimals: number,
  rest: { unit?: string; text?: string; where?: string } = {},
): Figure => {
  const f: Figure = { id, label, value, decimals };
  if (rest.unit !== undefined) f.unit = rest.unit;
  if (rest.text !== undefined) f.text = rest.text;
  if (rest.where !== undefined) f.where = rest.where;
  return f;
};

export function weatherFigures(w: WeatherState | undefined): Figure[] {
  if (!w) return [];
  const name = (id: string) => w.stations.find((s) => s.id === id)?.name.en ?? id;
  const out: Figure[] = [];
  const x = w.extremes;
  if (x.warmest)
    out.push(
      fig("warmest", FL.warmest, x.warmest.value, 1, {
        unit: "°C",
        where: name(x.warmest.stationId),
      }),
    );
  if (x.coldest)
    out.push(
      fig("coldest", FL.coldest, x.coldest.value, 1, {
        unit: "°C",
        where: name(x.coldest.stationId),
      }),
    );
  if (x.windiestGust)
    out.push(
      fig("gust", FL.strongestGust, x.windiestGust.value, 0, {
        unit: "km/h",
        where: name(x.windiestGust.stationId),
      }),
    );
  if (w.rainingShare !== undefined)
    out.push(
      fig("rain-share", FL.stationsRain, w.rainingShare * 100, 0, {
        unit: "%",
        where: `${w.stations.length} stations`,
      }),
    );
  return out;
}

export function waterFigures(h: HydrologyState | undefined): Figure[] {
  if (!h) return [];
  const out: Figure[] = [];
  const basel = h.observations.find(
    (o) => o.stationId === "bafu:2289" && o.parameter === "discharge",
  );
  if (basel)
    out.push(
      fig("rhine-basel", FL.rhineBasel, basel.value, 0, {
        unit: "m³/s",
        where: "FOEN, Rheinhalle",
      }),
    );
  const elevated = Object.values(h.dangerLevels).filter((d) => d >= 2).length;
  out.push(
    fig("flood-danger", FL.floodDanger, elevated, 0, {
      unit: elevated === 1 ? "station ≥ level 2" : "stations ≥ level 2",
      where: `${Object.keys(h.dangerLevels).length} classified stations`,
    }),
  );
  const temps = h.observations.filter((o) => o.parameter === "waterTemperature");
  const warmest = temps.reduce<(typeof temps)[number] | undefined>(
    (b, o) => (!b || o.value > b.value ? o : b),
    undefined,
  );
  if (warmest) {
    const st = h.stations.find((s) => s.id === warmest.stationId);
    out.push(
      fig("warmest-river", FL.warmestRiver, warmest.value, 1, {
        unit: "°C",
        where: `${st?.waterBody ?? ""} ${st?.name.de ?? ""}`.trim(),
      }),
    );
  }
  return out;
}

export function railFigures(rail: RailState | undefined, nowMs: number): Figure[] {
  if (!rail) return [];
  const out: Figure[] = [];
  const running = rail.activeTrips.filter((t) => !t.cancelled);
  out.push(
    fig("running", FL.trainsRunning, running.length, 0, {
      where: "positions estimated from timetable + live delays",
    }),
  );
  if (rail.onTimeIndex !== undefined)
    out.push(
      fig("on-time", FL.onTime, rail.onTimeIndex * 100, 0, {
        unit: "%",
        where: "< 3 min at the last stop passed",
      }),
    );
  let worst: { trip: (typeof running)[number]; delay: number } | undefined;
  for (const t of running) {
    const d = currentDelay(t, nowMs);
    if (!worst || d > worst.delay) worst = { trip: t, delay: d };
  }
  if (worst && worst.delay >= 180)
    out.push(
      fig("largest-delay", FL.largestDelay, worst.delay / 60, 0, {
        unit: "min",
        where: `${worst.trip.routeShortName} → ${worst.trip.headsign ?? ""}`.trim(),
      }),
    );
  if (rail.disruptions.length > 0)
    out.push(
      fig("disruptions", FL.disruptions, rail.disruptions.length, 0, {
        unit: rail.disruptions.length === 1 ? "section" : "sections",
        where: rail.disruptions[0]!.affects?.join(" – ") ?? rail.disruptions[0]!.headline.de,
      }),
    );
  const cancelled = rail.activeTrips.length - running.length;
  if (cancelled > 0)
    out.push(
      fig("cancelled", FL.cancelled, cancelled, 0, {
        unit: cancelled === 1 ? "train" : "trains",
        where: "in the current window",
      }),
    );
  return out;
}

export function quakeFigures(q: SeismicState | undefined, nowMs: number): Figure[] {
  if (!q) return [];
  const out: Figure[] = [];
  const place = (e: (typeof q.events)[number]) =>
    (e.headline.en ?? "").replace(/^M[\d.]+ earthquake near /, "");
  const latest = q.events[0];
  if (latest) {
    const hours = (nowMs - new Date(latest.startsAt).getTime()) / 3_600_000;
    const m = latest.magnitude ?? 0;
    out.push(
      fig("last-quake", FL.lastQuake, m, 1, {
        text: `M${m.toFixed(1)}`,
        where: `${place(latest)} · ${hours < 48 ? `${Math.round(hours)} h ago` : `${Math.round(hours / 24)} days ago`}`,
      }),
    );
  }
  const strong = q.events.filter((e) => (e.magnitude ?? 0) >= 2);
  out.push(
    fig(
      "quake-count",
      t(
        `Erdbeben, ${q.windowDays} Tage`,
        `Quakes, ${q.windowDays} days`,
        `Séismes, ${q.windowDays} jours`,
        `Terremoti, ${q.windowDays} giorni`,
      ),
      q.events.length,
      0,
      {
        where: `${strong.length} ≥ M 2`,
      },
    ),
  );
  const strongest = q.events.reduce<(typeof q.events)[number] | undefined>(
    (b, e) => (!b || (e.magnitude ?? 0) > (b.magnitude ?? 0) ? e : b),
    undefined,
  );
  if (strongest && strongest !== latest) {
    const m = strongest.magnitude ?? 0;
    out.push(
      fig("strongest", FL.strongest, m, 1, { text: `M${m.toFixed(1)}`, where: place(strongest) }),
    );
  }
  return out;
}

export function politicsFigures(
  p: PoliticsState | undefined,
  vote: VoteResult | undefined,
  nowMs: number,
): Figure[] {
  const out: Figure[] = [];
  if (vote) {
    const title = vote.meta.title.en ?? vote.meta.title.de;
    if (vote.national.yesPct !== null)
      out.push(
        fig("yes", FL.yes, vote.national.yesPct, 1, {
          unit: "%",
          where:
            vote.meta.national?.accepted === undefined
              ? title
              : `${vote.meta.national.accepted ? "accepted" : "rejected"} · ${title}`,
        }),
      );
    if (vote.national.turnoutPct !== null)
      out.push(
        fig("turnout", FL.turnout, vote.national.turnoutPct, 1, {
          unit: "%",
          where: `${Object.keys(vote.byMunicipality).length} municipalities`,
        }),
      );
    const n = vote.meta.national;
    if (n?.cantonsYes !== undefined && n.cantonsNo !== undefined)
      out.push(
        fig("cantons", FL.cantons, n.cantonsYes, 1, {
          text: `${n.cantonsYes} : ${n.cantonsNo}`,
          where: "yes : no (half cantons count ½)",
        }),
      );
  }
  const next = p?.upcoming[0];
  if (next) {
    const days = Math.max(
      0,
      Math.round((new Date(`${next.date}T12:00:00+02:00`).getTime() - nowMs) / 86_400_000),
    );
    out.push(
      fig("next-vote", FL.nextVote, days, 0, {
        unit: days === 1 ? "day" : "days",
        where: `${next.date}${next.proposals ? ` · ${next.proposals} proposals` : ""}`,
      }),
    );
  }
  return out;
}

export function energyFigures(e: EnergyState | undefined): Figure[] {
  if (!e) return [];
  const out: Figure[] = [];
  if (e.netImportMW !== undefined) {
    const imp = e.netImportMW >= 0;
    const parts = (Object.entries(e.borderFlows) as [string, number][])
      .filter(([, v]) => (imp ? v > 0 : v < 0))
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([k, v]) => `${k} ${Math.round(Math.abs(v))}`);
    out.push(
      fig("net-flow", imp ? FL.netImport : FL.netExport, Math.abs(e.netImportMW), 0, {
        unit: "MW",
        where: `${parts.join(" · ")} · 20 min delayed`,
      }),
    );
  }
  if (e.frequencyHz !== undefined)
    out.push(
      fig("frequency", FL.gridFrequency, e.frequencyHz, 3, {
        unit: "Hz",
        where:
          e.gridTimeDeviationS !== undefined
            ? `grid time ${e.gridTimeDeviationS > 0 ? "+" : ""}${e.gridTimeDeviationS.toFixed(2)} s`
            : "Swissgrid",
      }),
    );
  if (e.price)
    out.push(
      fig("price", FL.dayAheadPrice, e.price.eurPerMWh, 0, {
        unit: "€/MWh",
        where: "this hour · Energy-Charts",
      }),
    );
  if (e.reservoir) {
    const total = e.reservoir.regions.total;
    if (total && total.maxGwh > 0)
      out.push(
        fig("reservoirs", FL.reservoirs, (total.gwh / total.maxGwh) * 100, 0, {
          unit: "%",
          where: `${Math.round(total.gwh)} of ${Math.round(total.maxGwh)} GWh · ${e.reservoir.date}`,
        }),
      );
  }
  if (e.generation?.renewableSharePct !== undefined)
    out.push(
      fig("renewable", FL.renewableShare, e.generation.renewableSharePct, 0, {
        unit: "%",
        where: `of generation · nuclear ${Math.round((e.generation.byTypeMW.nuclear ?? 0) / 100) / 10} GW`,
      }),
    );
  return out;
}

export function eventsFigures(ev: EventsState | undefined, nowMs: number): Figure[] {
  if (!ev) return [];
  const sixH = ev.events.filter((e) => nowMs - new Date(e.publishedAt).getTime() < 6 * 3_600_000);
  const placed = ev.events.filter((e) => e.place && e.place.confidence >= 0.6);
  const byCanton = new Map<string, number>();
  for (const e of placed)
    if (e.place?.cantonCode)
      byCanton.set(e.place.cantonCode, (byCanton.get(e.place.cantonCode) ?? 0) + 1);
  const top = [...byCanton.entries()].sort((a, b) => b[1] - a[1])[0];
  const out: Figure[] = [
    fig("events-6h", FL.events6h, sixH.length, 0, {
      where: `${ev.events.length} in ${ev.windowHours} h · police and SRF`,
    }),
    fig("placed", FL.placedOnMap, placed.length, 0, {
      where: `${Math.round((placed.length / Math.max(1, ev.events.length)) * 100)} % geocoded`,
    }),
  ];
  if (top) out.push(fig("top-canton", FL.mostEvents, top[1], 0, { where: `canton ${top[0]}` }));
  return out;
}

const INDEX_LABEL = ["", "good", "fair", "moderate", "poor", "very poor", "hazardous"];
const PARAM_LABEL: Record<string, string> = {
  pollenGrasses: "grasses",
  pollenBirch: "birch",
  pollenHazel: "hazel",
  pollenAlder: "alder",
  pollenAsh: "ash",
  pollenBeech: "beech",
  pollenOak: "oak",
};

export function airFigures(a: AirState | undefined): Figure[] {
  if (!a) return [];
  const out: Figure[] = [];
  const name = (id: string) => a.stations.find((s) => s.id === id)?.name.en ?? id;
  if (a.worstIndex !== undefined) {
    const worst = Object.entries(a.indexByStation)
      .filter(([id]) => a.stations.find((s) => s.id === id)?.tier === "reference")
      .sort((x, y) => y[1] - x[1])[0];
    out.push(
      fig("air-index", FL.airQuality, a.worstIndex, 0, {
        text: `${a.worstIndex} · ${INDEX_LABEL[a.worstIndex]}`,
        where: worst ? `worst at ${name(worst[0])} · Zürich UGZ` : "Zürich UGZ",
      }),
    );
  }
  const pm = a.observations.filter(
    (o) =>
      o.parameter === "pm25" && a.stations.find((s) => s.id === o.stationId)?.tier === "reference",
  );
  const pmMax = pm.reduce<(typeof pm)[number] | undefined>(
    (b, o) => (!b || o.value > b.value ? o : b),
    undefined,
  );
  if (pmMax)
    out.push(
      fig("pm25", FL.pm25, pmMax.value, 1, {
        unit: "µg/m³",
        where: `${name(pmMax.stationId)} · hourly`,
      }),
    );
  const citizen = a.stations.filter((s) => s.tier === "citizen").length;
  if (citizen)
    out.push(
      fig("citizen", FL.citizenSensors, citizen, 0, {
        where: "Sensor.Community, PM only, low-cost hardware",
      }),
    );
  const pollen = a.pollen.observations.reduce<(typeof a.pollen.observations)[number] | undefined>(
    (b, o) => (!b || o.value > b.value ? o : b),
    undefined,
  );
  if (pollen && pollen.value > 0) {
    const st = a.pollen.stations.find((s) => s.id === pollen.stationId);
    out.push(
      fig("pollen", FL.pollen, pollen.value, 0, {
        unit: "/m³",
        where: `${PARAM_LABEL[pollen.parameter] ?? pollen.parameter} · ${st?.name.en ?? ""}`,
      }),
    );
  }
  return out;
}

export function hazardsFigures(
  h: HazardsState | undefined,
  q: SeismicState | undefined,
  nowMs: number,
): Figure[] {
  const out: Figure[] = [];
  if (h) {
    const fire = h.fireDanger.regions;
    const max = fire.reduce((m, r) => Math.max(m, r.level), 0);
    if (fire.length)
      out.push(
        fig("fire", FL.fireDanger, max, 0, {
          text: `level ${max}`,
          where: `${fire.filter((r) => r.level >= 3).length} of ${fire.length} regions at 3 or more`,
        }),
      );
    const av = h.avalanche.regions.reduce((m, r) => Math.max(m, r.level), 0);
    if (h.avalanche.inSeason)
      out.push(
        fig("avalanche", FL.avalancheDanger, av, 0, {
          text: av ? `level ${av}` : "—",
          where: `${h.avalanche.regions.length} regions · SLF bulletin`,
        }),
      );
    const snow = h.snow.observations
      .filter((o) => o.parameter === "snowDepth")
      .reduce<{ v: number; id: string } | undefined>(
        (b, o) => (!b || o.value > b.v ? { v: o.value, id: o.stationId } : b),
        undefined,
      );
    if (snow && snow.v > 0)
      out.push(
        fig("snow", FL.deepestSnow, snow.v, 0, {
          unit: "cm",
          where: `${h.snow.stations.find((s) => s.id === snow.id)?.name.en ?? ""} · IMIS`,
        }),
      );
    if (h.hail)
      out.push(
        fig("hail", FL.hail, 1, 0, { text: "detected", where: "MeteoSwiss radar, last hour" }),
      );
  }
  return [...out, ...quakeFigures(q, nowMs).slice(0, 2)];
}

export function statsFigures(st: TopicStates["stats"]): Figure[] {
  if (!st) return [];
  const { series, nameOf } = st;
  const pi = st.period ? series.periods.indexOf(st.period) : -1;
  const vals =
    pi >= 0
      ? Object.fromEntries(
          Object.entries(series.values).flatMap(([k, arr]) =>
            typeof arr[pi] === "number" ? [[k, arr[pi] as number]] : [],
          ),
        )
      : latestValues(series).values;
  const period = pi >= 0 ? st.period! : latestValues(series).period;
  const label = series.meta.label.en ?? series.meta.label.de;
  const out: Figure[] = [];
  const unit = series.meta.unit || undefined;
  if (typeof vals["CH"] === "number")
    out.push(
      fig(
        "national",
        withSuffix(series.meta.label, t(", Schweiz", ", Switzerland", ", Suisse", ", Svizzera")),
        vals["CH"],
        series.meta.decimals,
        {
          ...(unit ? { unit } : {}),
          where: `${period} · ${series.meta.attribution}`,
        },
      ),
    );
  const isCanton = (k: string) => /^[A-Z]{2}$/.test(k);
  const places = Object.entries(vals).filter(
    ([k]) => k !== "CH" && isCanton(k) === (series.meta.geoLevel === "canton"),
  );
  const top = places.sort((a, b) => b[1] - a[1])[0];
  if (top)
    out.push(
      fig("top", FL.highest, top[1], series.meta.decimals, {
        ...(unit ? { unit } : {}),
        where: nameOf(top[0]),
      }),
    );
  const low = places[places.length - 1];
  if (low && places.length > 2)
    out.push(
      fig("low", FL.lowest, low[1], series.meta.decimals, {
        ...(unit ? { unit } : {}),
        where: nameOf(low[0]),
      }),
    );
  out.push(
    fig(
      "count",
      series.meta.geoLevel === "canton" ? FL.cantons : FL.municipalities,
      places.length,
      0,
      { where: `with a value for ${period}` },
    ),
  );
  return out;
}

/** Figures for a topic; NOW composes the leads of its contributors. */
/** Attaches the registry attribution to each figure; `pick` chooses the source per figure id. */
function tag(figs: Figure[], id: SourceId | ((f: Figure) => SourceId)): Figure[] {
  return figs.map((f) => ({
    ...f,
    source: SOURCES[typeof id === "function" ? id(f) : id].attribution,
  }));
}
const hazardSource = (f: Figure): SourceId =>
  f.id === "snow"
    ? "slf-imis"
    : f.id === "avalanche"
      ? "slf-bulletin"
      : f.id === "hail"
        ? "meteoswiss-hail"
        : f.id === "fire"
          ? "bafu-fire-danger"
          : "sed-fdsn";
const energySource = (f: Figure): SourceId =>
  f.id === "reservoirs"
    ? "sfoe-reservoirs"
    : f.id === "price" || f.id === "renewable"
      ? "energy-charts"
      : "swissgrid-live";
const airSource = (f: Figure): SourceId =>
  f.id === "citizen" ? "sensor-community" : f.id === "pollen" ? "meteoswiss-pollen" : "ugz-air";

export function figuresFor(topic: TopicId, s: TopicStates, nowMs = Date.now()): Figure[] {
  switch (topic) {
    case "weather":
      return tag(weatherFigures(s.weather), "meteoswiss-smn");
    case "water":
      return tag(waterFigures(s.hydrology), "bafu-lindas-hydro");
    case "rail":
      return tag(railFigures(s.rail, nowMs), "otd-gtfs-rt");
    case "hazards":
      return tag(hazardsFigures(s.hazards, s.seismic, nowMs), hazardSource);
    case "air":
      return tag(airFigures(s.air), airSource);
    case "population":
    case "housing":
    case "economy":
    case "tourism":
      return statsFigures(s.stats);
    case "politics":
      return tag(politicsFigures(s.politics, s.vote, nowMs), "bfs");
    case "energy":
      return tag(energyFigures(s.energy), energySource);
    case "events":
      return tag(eventsFigures(s.events, nowMs), "polizei-news");
    case "now":
      return [
        ...tag(weatherFigures(s.weather).slice(0, 2), "meteoswiss-smn"),
        ...tag(
          railFigures(s.rail, nowMs).filter((f) => f.id === "on-time"),
          "otd-gtfs-rt",
        ),
        ...tag(waterFigures(s.hydrology).slice(0, 1), "bafu-lindas-hydro"),
        ...tag(energyFigures(s.energy).slice(0, 1), "swissgrid-live"),
      ];
    default:
      return [];
  }
}

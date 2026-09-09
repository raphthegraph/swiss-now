import type {
  AirState,
  EventsState,
  HydrologyState,
  NewsEvent,
  Observation,
  PoliticsState,
  RailState,
  VoteMeta,
  WeatherState,
} from "@swiss-now/core";
import type { LocalizedText } from "@swiss-now/core/state";
import type { Snapshot } from "@swiss-now/core/snapshot";
import { indicatorPlaceFigures, votePlaceFigures, type Figure } from "@swiss-now/core/topics";
import { haversineMeters } from "@swiss-now/motion/math";
import { localSummary, type LocalSummary } from "@/lib/local-summary";
import { getRegister } from "@/lib/state/geo";
import { getIndicator } from "@/lib/state/stats";
import { readRailJson } from "@/lib/state/rail";

export interface PlaceDeparture {
  line: string;
  headsign: string | undefined;
  stopName: string;
  scheduled: string;
  delaySeconds: number;
  cancelled: boolean;
}

export interface PlaceBundle {
  key: string;
  kind: "municipality" | "canton";
  name: string;
  canton: string;
  cantonName: string;
  lonLat: [number, number];
  generatedAt: string;
  weather?: {
    stationName: string;
    distanceKm: number;
    observedAt?: string;
    values: Partial<Record<Observation["parameter"], number>>;
    freshness: WeatherState["freshness"];
  };
  history?: { slots: string[]; temperature: (number | null)[] };
  river?: LocalSummary["river"];
  air?: {
    stationName: string;
    distanceKm: number;
    index?: number;
    pm25?: number;
    tier: "reference" | "citizen";
  };
  rail?: { stops: { name: string; distanceKm: number }[]; departures: PlaceDeparture[] };
  events: NewsEvent[];
  stats: { id: string; label: LocalizedText; figures: Figure[] }[];
  votes: { meta: VoteMeta; figures: Figure[] }[];
}

function latestByParam(observations: Observation[], stationId: string) {
  const m = new Map<Observation["parameter"], Observation>();
  for (const o of observations) {
    if (o.stationId !== stationId) continue;
    const prev = m.get(o.parameter);
    if (!prev || o.observedAt > prev.observedAt) m.set(o.parameter, o);
  }
  return m;
}

/** The indicators the place page shows per municipality (statistics topics' map indicators). */
const MUNI_INDICATORS = ["population", "vacancy-rate", "jobs-fte"];
const CANTON_INDICATORS = ["overnight-stays"];

export interface PlaceInputs {
  now: Date;
  weather?: WeatherState | undefined;
  hydrology?: HydrologyState | undefined;
  rail?: RailState | undefined;
  air?: AirState | undefined;
  events?: EventsState | undefined;
  politics?: PoliticsState | undefined;
  latestSnapshot?: Snapshot | undefined;
}

/** Everything the app knows about one municipality or canton, assembled from the live states. */
export async function buildPlace(key: string, i: PlaceInputs): Promise<PlaceBundle | undefined> {
  const reg = await getRegister();
  const canton = reg.cantons[key];
  const muni = canton ? undefined : reg.municipalities.find((m) => String(m.bfs) === key);
  if (!canton && !muni) return undefined;
  const lonLat = (canton ? canton.lonLat : muni!.lonLat) as [number, number];
  const cantonCode = canton ? key : muni!.canton;
  const bundle: PlaceBundle = {
    key,
    kind: canton ? "canton" : "municipality",
    name: canton ? canton.name : muni!.name,
    canton: cantonCode,
    cantonName: reg.cantons[cantonCode]?.name ?? cantonCode,
    lonLat,
    generatedAt: i.now.toISOString(),
    events: [],
    stats: [],
    votes: [],
  };

  // weather: every parameter of the nearest station with a temperature
  if (i.weather) {
    const summary = localSummary(lonLat, i.weather, i.hydrology);
    if (summary) {
      const station = i.weather.stations.find(
        (s) => (s.name.en ?? s.name.de) === summary.stationName,
      );
      const values: PlaceBundle["weather"] extends infer W
        ? W extends { values: infer V }
          ? V
          : never
        : never = {};
      let observedAt: string | undefined;
      if (station) {
        for (const [param, o] of latestByParam(i.weather.observations, station.id)) {
          values[param] = o.value;
          if (!observedAt || o.observedAt > observedAt) observedAt = o.observedAt;
        }
        const hist = i.latestSnapshot?.history;
        const series = hist?.temperature[station.id];
        if (hist && series && series.some((v) => v !== null))
          bundle.history = { slots: hist.slots, temperature: series };
      }
      bundle.weather = {
        stationName: summary.stationName,
        distanceKm: summary.distanceKm,
        values,
        freshness: i.weather.freshness,
        ...(observedAt ? { observedAt } : {}),
      };
      if (summary.river) bundle.river = summary.river;
    }
  }

  // air: nearest reference station, or the nearest citizen sensor when no reference is close
  if (i.air) {
    let best: { name: string; d: number; id: string; tier: "reference" | "citizen" } | undefined;
    for (const s of i.air.stations) {
      const d = haversineMeters(lonLat, s.lonLat);
      const tier = (s.tier ?? "reference") as "reference" | "citizen";
      const limit = tier === "reference" ? 30_000 : 8_000;
      if (d > limit) continue;
      const better = !best || (tier === "reference" && best.tier === "citizen") || d < best.d;
      if (better && !(best && best.tier === "reference" && tier === "citizen"))
        best = { name: s.name.en ?? s.name.de, d, id: s.id, tier };
    }
    if (best) {
      const obs = latestByParam(i.air.observations, best.id);
      const pm = obs.get("pm25");
      const index = i.air.indexByStation[best.id];
      bundle.air = {
        stationName: best.name,
        distanceKm: Math.round(best.d / 100) / 10,
        tier: best.tier,
        ...(index !== undefined ? { index } : {}),
        ...(pm ? { pm25: pm.value } : {}),
      };
    }
  }

  // rail: stops within reach and the next departures through them, from our own trip state
  if (i.rail) {
    const stops = await readRailJson<Record<string, [number, number, string, string]>>(
      "stops.json",
    ).catch(() => undefined);
    if (stops) {
      const near: { id: string; name: string; d: number }[] = [];
      for (const [id, s] of Object.entries(stops)) {
        const d = haversineMeters(lonLat, [s[0], s[1]]);
        if (d <= (canton ? 6_000 : 3_000)) near.push({ id, name: s[2], d });
      }
      near.sort((a, b) => a.d - b.d);
      const nameOf = new Map(near.map((n) => [n.id, n.name]));
      const nowMs = i.now.getTime();
      // the stops that matter are the busy ones: count departures per stop first, keep the top three
      const perStop = new Map<string, number>();
      for (const trip of i.rail.activeTrips)
        for (const st of trip.stops)
          if (nameOf.has(st.stopId) && !st.skipped) {
            const actual = new Date(st.scheduledDeparture).getTime() + st.delaySeconds * 1000;
            if (actual >= nowMs - 60_000 && actual <= nowMs + 90 * 60_000)
              perStop.set(st.stopId, (perStop.get(st.stopId) ?? 0) + 1);
          }
      const busiest = [...perStop.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      const nearIds = new Set(
        busiest.length ? busiest.map(([id]) => id) : near.slice(0, 3).map((n) => n.id),
      );
      const departures: PlaceDeparture[] = [];
      for (const trip of i.rail.activeTrips) {
        for (const st of trip.stops) {
          if (!nearIds.has(st.stopId) || st.skipped) continue;
          const actual = new Date(st.scheduledDeparture).getTime() + st.delaySeconds * 1000;
          if (actual < nowMs - 60_000 || actual > nowMs + 90 * 60_000) continue;
          departures.push({
            line: trip.routeShortName,
            headsign: trip.headsign,
            stopName: nameOf.get(st.stopId) ?? st.stopId,
            scheduled: st.scheduledDeparture,
            delaySeconds: st.delaySeconds,
            cancelled: trip.cancelled,
          });
        }
      }
      departures.sort(
        (a, b) =>
          new Date(a.scheduled).getTime() +
          a.delaySeconds * 1000 -
          (new Date(b.scheduled).getTime() + b.delaySeconds * 1000),
      );
      bundle.rail = {
        stops: near
          .filter((n) => nearIds.has(n.id))
          .map((n) => ({ name: n.name, distanceKm: Math.round(n.d / 100) / 10 })),
        departures: departures.slice(0, 10),
      };
    }
  }

  // events of the last day within reach
  if (i.events) {
    const cutoff = i.now.getTime() - 24 * 3_600_000;
    bundle.events = i.events.events
      .filter(
        (e) =>
          e.place &&
          new Date(e.publishedAt).getTime() >= cutoff &&
          haversineMeters(lonLat, e.place.lonLat) <= (canton ? 40_000 : 15_000),
      )
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
      .slice(0, 8);
  }

  // statistics with rank, from the built indicator files
  const ids = canton ? [...MUNI_INDICATORS, ...CANTON_INDICATORS] : MUNI_INDICATORS;
  for (const id of ids) {
    const series = await getIndicator(id).catch(() => undefined);
    if (!series) continue;
    const geoKey = series.meta.geoLevel === "canton" ? cantonCode : key;
    if (series.meta.geoLevel === "canton" && !canton && id !== "overnight-stays") continue;
    const figures = indicatorPlaceFigures(series, geoKey);
    if (figures.length) bundle.stats.push({ id, label: series.meta.label, figures });
  }

  // the latest vote Sunday, this place against the country
  if (i.politics) {
    for (const vote of i.politics.latest) {
      const figures = votePlaceFigures(vote, canton ? cantonCode : key);
      if (figures.length) bundle.votes.push({ meta: vote.meta, figures });
    }
  }
  return bundle;
}

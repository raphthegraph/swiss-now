/**
 * Key figures per topic — the shared figure model for the HUD strip, charts and compare views
 * (same shape as the story's `ChapterFigure`, so the video can reuse them). Formatting is the
 * renderer's job; `text` carries values that are not numbers (e.g. `M2.5`).
 */
import type { HydrologyState, RailState, SeismicState, WeatherState } from "../state/layers";
import type { PoliticsState, VoteResult } from "../state/politics";
import { currentDelay } from "../data-sources/transit/rail-state";
import type { TopicId } from "./spec";

export interface Figure {
  id: string;
  label: string;
  value: number;
  decimals: number;
  unit?: string;
  /** Display text overriding the number (renderer shows it verbatim). */
  text?: string;
  /** Secondary line: place, source, qualifier. */
  where?: string;
}

export interface TopicStates {
  weather?: WeatherState | undefined;
  hydrology?: HydrologyState | undefined;
  rail?: RailState | undefined;
  seismic?: SeismicState | undefined;
  politics?: PoliticsState | undefined;
  /** the vote currently shown (latest or the timeline selection) */
  vote?: VoteResult | undefined;
}

const fig = (
  id: string,
  label: string,
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
      fig("warmest", "Warmest", x.warmest.value, 1, {
        unit: "°C",
        where: name(x.warmest.stationId),
      }),
    );
  if (x.coldest)
    out.push(
      fig("coldest", "Coldest", x.coldest.value, 1, {
        unit: "°C",
        where: name(x.coldest.stationId),
      }),
    );
  if (x.windiestGust)
    out.push(
      fig("gust", "Strongest gust", x.windiestGust.value, 0, {
        unit: "km/h",
        where: name(x.windiestGust.stationId),
      }),
    );
  if (w.rainingShare !== undefined)
    out.push(
      fig("rain-share", "Stations reporting rain", w.rainingShare * 100, 0, {
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
      fig("rhine-basel", "Rhine at Basel", basel.value, 0, {
        unit: "m³/s",
        where: "FOEN, Rheinhalle",
      }),
    );
  const elevated = Object.values(h.dangerLevels).filter((d) => d >= 2).length;
  out.push(
    fig("flood-danger", "Flood danger", elevated, 0, {
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
      fig("warmest-river", "Warmest river", warmest.value, 1, {
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
    fig("running", "Trains running", running.length, 0, {
      where: "positions estimated from timetable + live delays",
    }),
  );
  if (rail.onTimeIndex !== undefined)
    out.push(
      fig("on-time", "On time", rail.onTimeIndex * 100, 0, {
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
      fig("largest-delay", "Largest delay", worst.delay / 60, 0, {
        unit: "min",
        where: `${worst.trip.routeShortName} → ${worst.trip.headsign ?? ""}`.trim(),
      }),
    );
  if (rail.disruptions.length > 0)
    out.push(
      fig("disruptions", "Disruptions", rail.disruptions.length, 0, {
        unit: rail.disruptions.length === 1 ? "section" : "sections",
        where: rail.disruptions[0]!.affects?.join(" – ") ?? rail.disruptions[0]!.headline.de,
      }),
    );
  const cancelled = rail.activeTrips.length - running.length;
  if (cancelled > 0)
    out.push(
      fig("cancelled", "Cancelled", cancelled, 0, {
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
      fig("last-quake", "Last earthquake", m, 1, {
        text: `M${m.toFixed(1)}`,
        where: `${place(latest)} · ${hours < 48 ? `${Math.round(hours)} h ago` : `${Math.round(hours / 24)} days ago`}`,
      }),
    );
  }
  const strong = q.events.filter((e) => (e.magnitude ?? 0) >= 2);
  out.push(
    fig("quake-count", `Quakes, ${q.windowDays} days`, q.events.length, 0, {
      where: `${strong.length} of magnitude 2 or more`,
    }),
  );
  const strongest = q.events.reduce<(typeof q.events)[number] | undefined>(
    (b, e) => (!b || (e.magnitude ?? 0) > (b.magnitude ?? 0) ? e : b),
    undefined,
  );
  if (strongest && strongest !== latest) {
    const m = strongest.magnitude ?? 0;
    out.push(
      fig("strongest", "Strongest", m, 1, { text: `M${m.toFixed(1)}`, where: place(strongest) }),
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
        fig("yes", "Yes", vote.national.yesPct, 1, {
          unit: "%",
          where:
            vote.meta.national?.accepted === undefined
              ? title
              : `${vote.meta.national.accepted ? "accepted" : "rejected"} · ${title}`,
        }),
      );
    if (vote.national.turnoutPct !== null)
      out.push(
        fig("turnout", "Turnout", vote.national.turnoutPct, 1, {
          unit: "%",
          where: `${Object.keys(vote.byMunicipality).length} municipalities`,
        }),
      );
    const n = vote.meta.national;
    if (n?.cantonsYes !== undefined && n.cantonsNo !== undefined)
      out.push(
        fig("cantons", "Cantons", n.cantonsYes, 1, {
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
      fig("next-vote", "Next vote Sunday", days, 0, {
        unit: days === 1 ? "day" : "days",
        where: `${next.date}${next.proposals ? ` · ${next.proposals} proposals` : ""}`,
      }),
    );
  }
  return out;
}

/** Figures for a topic; NOW composes the leads of its contributors. */
export function figuresFor(topic: TopicId, s: TopicStates, nowMs = Date.now()): Figure[] {
  switch (topic) {
    case "weather":
      return weatherFigures(s.weather);
    case "water":
      return waterFigures(s.hydrology);
    case "rail":
      return railFigures(s.rail, nowMs);
    case "hazards":
      return quakeFigures(s.seismic, nowMs);
    case "politics":
      return politicsFigures(s.politics, s.vote, nowMs);
    case "now":
      return [
        ...weatherFigures(s.weather).slice(0, 2),
        ...railFigures(s.rail, nowMs).filter((f) => f.id === "on-time"),
        ...waterFigures(s.hydrology).slice(0, 1),
      ];
    default:
      return [];
  }
}

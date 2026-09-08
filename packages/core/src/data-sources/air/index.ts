/**
 * Air state assembly and the short-term index. Thresholds follow the Cercl'Air short-term air
 * quality index classes (1 good … 6 very poor) for hourly NO₂, O₃ and particulates; the station
 * index is the worst pollutant. Citizen sensors get an index too but are shown as their own tier.
 */
import type { AirIndex, AirState } from "../../state/layers";
import type { Observation, Parameter, Station } from "../../state/entities";
import { computeFreshness, worstFreshness } from "../../freshness/index";

const THRESHOLDS: Partial<Record<Parameter, number[]>> = {
  o3: [60, 120, 135, 180, 240],
  no2: [30, 60, 80, 100, 150],
  pm10: [20, 50, 75, 100, 150],
  pm25: [10, 25, 40, 55, 75],
};

export function airIndexFor(parameter: Parameter, value: number): AirIndex | undefined {
  const t = THRESHOLDS[parameter];
  if (!t) return undefined;
  let i = 1;
  for (const limit of t) if (value > limit) i++;
  return i as AirIndex;
}

export interface AirInputs {
  reference?: { stations: Station[]; observations: Observation[] } | undefined;
  citizen?: { stations: Station[]; observations: Observation[] } | undefined;
  pollen?: { stations: Station[]; observations: Observation[] } | undefined;
}

export function buildAirState(inputs: AirInputs, now = new Date()): AirState {
  const stations = [...(inputs.reference?.stations ?? []), ...(inputs.citizen?.stations ?? [])];
  const observations = [
    ...(inputs.reference?.observations ?? []),
    ...(inputs.citizen?.observations ?? []),
  ];
  const indexByStation: Record<string, AirIndex> = {};
  for (const o of observations) {
    // the hourly file lands 2–3 h after the hour; older than five hours makes no index
    if (now.getTime() - new Date(o.observedAt).getTime() > 5 * 3_600_000) continue;
    const i = airIndexFor(o.parameter, o.value);
    if (i !== undefined && (indexByStation[o.stationId] ?? 0) < i) indexByStation[o.stationId] = i;
  }
  const referenceIds = new Set((inputs.reference?.stations ?? []).map((s) => s.id));
  const referenceIndexes = Object.entries(indexByStation)
    .filter(([id]) => referenceIds.has(id))
    .map(([, i]) => i);
  const newest = (obs: Observation[]) =>
    obs.reduce<string | undefined>(
      (b, o) => (!b || o.observedAt > b ? o.observedAt : b),
      undefined,
    );
  const refAt = newest(inputs.reference?.observations ?? []);
  const citAt = newest(inputs.citizen?.observations ?? []);
  const state: AirState = {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    observedAt: refAt ?? citAt ?? now.toISOString(),
    freshness: worstFreshness([
      computeFreshness(refAt, 3600, 3 * 3600, now),
      inputs.citizen ? computeFreshness(citAt, 5 * 60, 5 * 60, now) : "live",
    ]),
    sources: ["ugz-air", "sensor-community", "meteoswiss-pollen"],
    stations,
    observations,
    indexByStation,
    pollen: inputs.pollen ?? { stations: [], observations: [] },
  };
  if (referenceIndexes.length) state.worstIndex = Math.max(...referenceIndexes) as AirIndex;
  return state;
}

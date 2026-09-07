import type { Observation, Station } from "../../state/entities";
import type { DangerLevel, HydrologyState } from "../../state/layers";
import { SCHEMA_VERSION } from "../../state/common";
import { freshnessForSource } from "../../freshness/index";
import { parseWktPoint, type HydroRow } from "./parse";

export const hydroStationId = (identifier: string): string => `bafu:${identifier}`;

export interface NormalizedHydro {
  stations: Station[];
  observations: Observation[];
  dangerLevels: Record<string, DangerLevel>;
  observedAt: string | undefined;
}

export function normalizeHydroRows(rows: HydroRow[]): NormalizedHydro {
  const stationsById = new Map<string, Station>();
  const observations: Observation[] = [];
  const dangerLevels: Record<string, DangerLevel> = {};
  let newest: string | undefined;

  for (const r of rows) {
    const id = hydroStationId(r.identifier.value);
    if (stationsById.has(id)) continue; // a station can appear once per water body it is "contained in"
    const lonLat = parseWktPoint(r.wkt.value);
    if (!lonLat) continue;
    const station: Station = {
      id,
      name: { de: r.name.value },
      kind: r.type.value === "lake" ? "hydro-lake" : "hydro-river",
      lonLat,
      source: "bafu-lindas-hydro",
    };
    if (r.waterBody?.value) station.waterBody = r.waterBody.value;
    stationsById.set(id, station);

    // measurementTime carries an explicit +01:00 offset year-round; parse as an instant
    const observedAt = new Date(r.t.value).toISOString();
    if (Number.isNaN(new Date(r.t.value).getTime())) continue;
    const push = (parameter: Observation["parameter"], raw?: { value: string }) => {
      if (!raw) return;
      const value = Number(raw.value);
      if (!Number.isFinite(value)) return;
      observations.push({ stationId: id, parameter, value, observedAt });
    };
    push("waterLevel", r.level);
    push("discharge", r.discharge); // m³/s (see query.ts on the misleading isLiter flag)
    push("waterTemperature", r.temp);
    const danger = Number(r.danger.value);
    if (Number.isInteger(danger) && danger >= 1 && danger <= 5)
      dangerLevels[id] = danger as DangerLevel;
    if (newest === undefined || observedAt > newest) newest = observedAt;
  }
  return { stations: [...stationsById.values()], observations, dangerLevels, observedAt: newest };
}

export function buildHydrologyState(n: NormalizedHydro, now: Date = new Date()): HydrologyState {
  const fallback = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: fallback,
    observedAt: n.observedAt ?? fallback,
    freshness: freshnessForSource("bafu-lindas-hydro", n.observedAt, now),
    sources: ["bafu-lindas-hydro"],
    stations: n.stations,
    observations: n.observations,
    dangerLevels: n.dangerLevels,
    warnings: [],
  };
}

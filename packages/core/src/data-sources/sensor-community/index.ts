/**
 * Sensor.Community particulate sensors (ODbL; low-cost citizen hardware, verified 2026-09-08).
 * Area filter around Switzerland: `airrohr/v1/filter/area=lat,lon,km`; each record is one sensor's
 * last measurement. Rendered as a separate "citizen" tier, never merged into the reference index.
 */
import type { Observation, Station } from "../../state/entities";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const SENSOR_COMMUNITY_URL =
  "https://data.sensor.community/airrohr/v1/filter/area=46.8,8.2,160";
const PM_SENSORS = new Set(["SDS011", "SPS30", "PMS5003", "PMS7003", "PMS1003", "HPM"]);

export interface ScRecord {
  id: number;
  timestamp: string;
  location: {
    id: number;
    latitude: string;
    longitude: string;
    altitude?: string;
    country?: string;
    indoor?: number;
  };
  sensor: { id: number; sensor_type: { name: string } };
  sensordatavalues: { value_type: string; value: string }[];
}

export const scStationId = (locationId: number) => `sc:${locationId}`;

export function parseSensorCommunity(records: ScRecord[]): {
  stations: Station[];
  observations: Observation[];
} {
  const stations = new Map<string, Station>();
  const observations: Observation[] = [];
  for (const r of records) {
    if (
      r.location.country !== "CH" ||
      r.location.indoor ||
      !PM_SENSORS.has(r.sensor.sensor_type.name)
    )
      continue;
    const lon = Number(r.location.longitude);
    const lat = Number(r.location.latitude);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const id = scStationId(r.location.id);
    const at = new Date(`${r.timestamp.replace(" ", "T")}Z`).toISOString();
    if (!stations.has(id)) {
      const st: Station = {
        id,
        name: { de: `Sensor ${r.location.id}`, en: `Sensor ${r.location.id}` },
        kind: "air",
        tier: "citizen",
        lonLat: [lon, lat],
        source: "sensor-community",
      };
      const alt = Number(r.location.altitude);
      if (Number.isFinite(alt)) st.elevation = alt;
      stations.set(id, st);
    }
    for (const v of r.sensordatavalues) {
      const value = Number(v.value);
      if (!Number.isFinite(value) || value < 0 || value > 2000) continue;
      if (v.value_type === "P1")
        observations.push({ stationId: id, parameter: "pm10", value, observedAt: at });
      if (v.value_type === "P2")
        observations.push({ stationId: id, parameter: "pm25", value, observedAt: at });
    }
  }
  return { stations: [...stations.values()], observations };
}

export async function fetchSensorCommunity(fetchFn: typeof fetch = fetch) {
  const res = await fetchFn(SENSOR_COMMUNITY_URL, {
    headers: { "user-agent": SWISS_NOW_USER_AGENT, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`sensor.community ${res.status}`);
  return parseSensorCommunity((await res.json()) as ScRecord[]);
}

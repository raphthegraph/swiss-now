/**
 * WSL Institute for Snow and Avalanche Research SLF (CC BY 4.0, verified 2026-09-08):
 * - avalanche bulletin as CAAML GeoJSON (`aws.slf.ch/api/bulletin/caaml/{lang}/geojson`), empty
 *   outside the winter season
 * - IMIS automatic stations: `measurement-api.slf.ch/public/api/imis/{stations,measurements}`,
 *   one day of half-hourly rows (snow depth HS in cm, air temperature TA), no filtering
 */
import type { DangerRegion } from "../../state/hazards";
import type { Observation, Station } from "../../state/entities";
import { CantonCode } from "../../state/common";
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const SLF_BULLETIN_URL = (lang = "de") =>
  `https://aws.slf.ch/api/bulletin/caaml/${lang}/geojson`;
export const IMIS_STATIONS_URL = "https://measurement-api.slf.ch/public/api/imis/stations";
export const IMIS_MEASUREMENTS_URL = "https://measurement-api.slf.ch/public/api/imis/measurements";

interface BulletinFeature {
  id?: string | number;
  properties?: Record<string, unknown>;
}
interface BulletinGeoJson {
  type?: string;
  features?: BulletinFeature[];
}

/** Regions with their danger level; the property names follow the CAAML export (tolerant). */
export function parseBulletin(json: BulletinGeoJson): DangerRegion[] {
  const out: DangerRegion[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties ?? {};
    const levelRaw = p["danger_level"] ?? p["dangerLevel"] ?? p["max_danger_rating"] ?? p["level"];
    const level = Number(String(levelRaw).replace(/\D/g, ""));
    if (!Number.isFinite(level) || level < 1 || level > 5) continue;
    const name = String(p["region_name"] ?? p["name"] ?? p["regionName"] ?? f.id ?? "");
    const r: DangerRegion = {
      id: String(f.id ?? p["region_id"] ?? name),
      name: { de: name, en: name },
      level,
    };
    const until = p["valid_until"] ?? p["validUntil"] ?? p["validEndTime"];
    if (typeof until === "string" && !Number.isNaN(Date.parse(until)))
      r.validUntil = new Date(until).toISOString();
    out.push(r);
  }
  return out;
}

export interface ImisStation {
  code: string;
  label: string;
  lon: number;
  lat: number;
  elevation?: number;
  canton_code?: string;
  country_code?: string;
  type?: string;
}
export interface ImisMeasurement {
  station_code: string;
  measure_date: string;
  HS?: number | null;
  TA_30MIN_MEAN?: number | null;
  VW_30MIN_MEAN?: number | null;
}

export const imisStationId = (code: string) => `imis:${code}`;

/** Latest row per station → snow depth and air temperature observations. */
export function parseImis(
  stations: ImisStation[],
  measurements: ImisMeasurement[],
): { stations: Station[]; observations: Observation[] } {
  const latest = new Map<string, ImisMeasurement>();
  for (const m of measurements) {
    const prev = latest.get(m.station_code);
    if (!prev || prev.measure_date < m.measure_date) latest.set(m.station_code, m);
  }
  const outStations: Station[] = [];
  const observations: Observation[] = [];
  for (const s of stations) {
    const m = latest.get(s.code);
    if (!m || (s.country_code === "LI" && false)) continue;
    const id = imisStationId(s.code);
    const st: Station = {
      id,
      name: { de: s.label, en: s.label },
      kind: "snow",
      lonLat: [s.lon, s.lat],
      source: "slf-imis",
    };
    if (s.elevation !== undefined) st.elevation = s.elevation;
    const canton = CantonCode.safeParse(s.canton_code);
    if (canton.success) st.cantonCode = canton.data;
    outStations.push(st);
    const at = new Date(m.measure_date).toISOString();
    if (typeof m.HS === "number" && m.HS >= 0)
      observations.push({ stationId: id, parameter: "snowDepth", value: m.HS, observedAt: at });
    if (typeof m.TA_30MIN_MEAN === "number")
      observations.push({
        stationId: id,
        parameter: "airTemperature",
        value: m.TA_30MIN_MEAN,
        observedAt: at,
      });
  }
  return { stations: outStations, observations };
}

const headers = { "user-agent": SWISS_NOW_USER_AGENT, accept: "application/json" };
export async function fetchBulletin(
  fetchFn: typeof fetch = fetch,
): Promise<{ regions: DangerRegion[]; raw: BulletinGeoJson }> {
  const res = await fetchFn(SLF_BULLETIN_URL("de"), { headers });
  if (!res.ok) throw new Error(`slf bulletin ${res.status}`);
  const raw = (await res.json()) as BulletinGeoJson;
  return { regions: parseBulletin(raw), raw };
}
export async function fetchImis(fetchFn: typeof fetch = fetch) {
  const [st, me] = await Promise.all([
    fetchFn(IMIS_STATIONS_URL, { headers }),
    fetchFn(IMIS_MEASUREMENTS_URL, { headers }),
  ]);
  if (!st.ok || !me.ok) throw new Error(`slf imis ${st.status}/${me.status}`);
  return parseImis((await st.json()) as ImisStation[], (await me.json()) as ImisMeasurement[]);
}

/** Hazards state assembly: fire regions, avalanche regions, snow stations, hail frame. */
import type { HazardsState, DangerRegion } from "../../state/hazards";
import type { Field, Observation, Station } from "../../state/entities";
import { computeFreshness, worstFreshness } from "../../freshness/index";
import { hailInSeason } from "../meteoswiss/hail/index";

export interface HazardsInputs {
  fire?: { regions: DangerRegion[]; issuedAt: string | undefined } | undefined;
  avalanche?: { regions: DangerRegion[] } | undefined;
  snow?: { stations: Station[]; observations: Observation[] } | undefined;
  hail?: Field | undefined;
  /** where the web app serves the region polygons */
  geojsonUrls: { fire: string; avalanche: string };
}

export function buildHazardsState(i: HazardsInputs, now = new Date()): HazardsState {
  const snowAt = i.snow?.observations.reduce<string | undefined>(
    (b, o) => (!b || o.observedAt > b ? o.observedAt : b),
    undefined,
  );
  const month = now.getUTCMonth() + 1;
  const avalancheSeason = month >= 11 || month <= 4;
  return {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    observedAt: snowAt ?? i.fire?.issuedAt ?? now.toISOString(),
    freshness: worstFreshness([
      i.fire ? computeFreshness(i.fire.issuedAt, 86_400, 12 * 3600, now) : "outage",
      i.snow ? computeFreshness(snowAt, 30 * 60, 30 * 60, now) : "outage",
    ]),
    sources: ["bafu-fire-danger", "slf-imis", "slf-bulletin", "meteoswiss-hail"],
    fireDanger: {
      regions: i.fire?.regions ?? [],
      geojsonUrl: i.geojsonUrls.fire,
      ...(i.fire?.issuedAt ? { issuedAt: i.fire.issuedAt } : {}),
    },
    avalanche: {
      regions: i.avalanche?.regions ?? [],
      geojsonUrl: i.geojsonUrls.avalanche,
      inSeason: avalancheSeason,
    },
    snow: i.snow ?? { stations: [], observations: [] },
    ...(i.hail ? { hail: i.hail } : {}),
    hailInSeason: hailInSeason(now),
  };
}

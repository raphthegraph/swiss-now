import type { Chapter, LayerId } from "@swiss-now/core";
import { layerAccent } from "@swiss-now/motion/tokens";

/** One accent per chapter, from the shared layer palette. */
export function chapterAccent(c: Chapter): string {
  switch (c.type) {
    case "rainfall":
    case "snow":
      return layerAccent.rain;
    case "rail":
      return layerAccent.railDelay;
    case "river":
      return layerAccent.hydrology;
    case "quake":
      return layerAccent.seismic;
    case "stat":
      return layerAccent.wind;
    case "energy":
      return layerAccent.energy;
    case "events":
      return layerAccent.events;
    case "hazard":
      return layerAccent.hazards;
    case "air":
      return layerAccent.air;
    case "vote":
      return layerAccent.politics;
    default:
      return layerAccent.weather;
  }
}

const CREDIT: Partial<Record<LayerId, string>> = {
  weather: "Source: MeteoSwiss",
  hydrology: "Source: FOEN",
  rail: "Source: opentransportdata.swiss",
  seismic: "Source: Swiss Seismological Service (SED) at ETH Zurich",
  energy: "Source: Swissgrid · Energy-Charts.info (Fraunhofer ISE)",
  events: "Source: polizei.news · SRF",
  hazards: "Source: FOEN · MeteoSwiss",
  air: "Source: Stadt Zürich UGZ",
  politics: "Source: BFS · swissvotes.ch",
};

/** Attribution line for a chapter; the basemap credit is always present. */
export function chapterCredit(c: Chapter): string {
  const s = CREDIT[c.layer];
  return s ? `${s} · © swisstopo` : "© swisstopo";
}

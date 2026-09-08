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
    default:
      return layerAccent.weather;
  }
}

const CREDIT: Partial<Record<LayerId, string>> = {
  weather: "Source: MeteoSwiss",
  hydrology: "Source: FOEN",
  rail: "Source: opentransportdata.swiss",
  seismic: "Source: Swiss Seismological Service (SED) at ETH Zurich",
};

/** Attribution line for a chapter; the basemap credit is always present. */
export function chapterCredit(c: Chapter): string {
  const s = CREDIT[c.layer];
  return s ? `${s} · © swisstopo` : "© swisstopo";
}

export function layerLabel(c: Chapter): string {
  return c.layer === "hydrology" ? "water" : c.layer === "seismic" ? "quakes" : c.layer;
}

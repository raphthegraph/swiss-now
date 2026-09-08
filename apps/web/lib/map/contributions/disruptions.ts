import type { GeoJSONSource } from "maplibre-gl";
import type { Event } from "@swiss-now/core";
import { ground, layerAccent } from "@swiss-now/motion/tokens";
import { disruptionsToGeoJSON } from "@/lib/map/disruptions-geojson";
import { show, type MapContribution } from "./types";

export const DISRUPTION_SOURCE = "rail-disruptions";
export const LAYER_DISRUPTION_LINES = "rail-disruption-lines";
export const LAYER_DISRUPTION_POINTS = "rail-disruption-points";

/** Rail disruptions: the affected section as a red hairline with end markers (trains are a canvas overlay). */
export function disruptionsContribution(
  initial: Event[] | undefined,
): MapContribution<Event[] | undefined> {
  return {
    id: "disruptions",
    layer: "rail",
    hoverLayers: [LAYER_DISRUPTION_POINTS, LAYER_DISRUPTION_LINES],
    install(map, { beforeId }) {
      map.addSource(DISRUPTION_SOURCE, {
        type: "geojson",
        data: disruptionsToGeoJSON(initial ?? []),
        promoteId: "id",
      });
      map.addLayer(
        {
          id: LAYER_DISRUPTION_LINES,
          type: "line",
          source: DISRUPTION_SOURCE,
          filter: ["==", ["geometry-type"], "LineString"],
          layout: { "line-cap": "round", visibility: "none" },
          paint: {
            "line-color": layerAccent.railDelay,
            "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2, 10, 4],
            "line-opacity": 0.85,
            "line-dasharray": [1, 1.5],
          },
        },
        beforeId,
      );
      map.addLayer({
        id: LAYER_DISRUPTION_POINTS,
        type: "circle",
        source: DISRUPTION_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 10, 7],
          "circle-color": layerAccent.railDelay,
          "circle-stroke-color": ground.paper,
          "circle-stroke-width": 1.5,
          "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.9],
        },
      });
    },
    update(map, disruptions) {
      (map.getSource(DISRUPTION_SOURCE) as GeoJSONSource | undefined)?.setData(
        disruptionsToGeoJSON(disruptions ?? []),
      );
    },
    setPresence(map, presence) {
      show(map, LAYER_DISRUPTION_LINES, presence !== "off");
      show(map, LAYER_DISRUPTION_POINTS, presence !== "off");
    },
  };
}

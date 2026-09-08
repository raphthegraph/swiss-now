import type { GeoJSONSource } from "maplibre-gl";
import type { WeatherState } from "@swiss-now/core";
import { ground } from "@swiss-now/motion/tokens";
import { colorExpression } from "@/lib/map/expressions";
import { stationsToGeoJSON } from "@/lib/map/stations-geojson";
import { show, type MapContribution } from "./types";

export const WEATHER_SOURCE = "weather-stations";
export const LAYER_CIRCLES = "weather-temp-circles";
export const LAYER_LABELS = "weather-temp-labels";

/** Station circles coloured by the shared temperature scale; labels only in the full view. */
export function weatherContribution(initial: WeatherState): MapContribution<WeatherState> {
  return {
    id: "weather",
    layer: "weather",
    hoverLayers: [LAYER_CIRCLES],
    install(map) {
      map.addSource(WEATHER_SOURCE, {
        type: "geojson",
        data: stationsToGeoJSON(initial),
        promoteId: "id",
      });
      map.addLayer({
        id: LAYER_CIRCLES,
        type: "circle",
        source: WEATHER_SOURCE,
        filter: ["has", "temp"],
        paint: {
          "circle-color": colorExpression("temp", "temperature"),
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3.5, 9, 7, 12, 12],
          "circle-stroke-color": ground.paper,
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1],
          "circle-opacity": 0.95,
        },
      });
      map.addLayer({
        id: LAYER_LABELS,
        type: "symbol",
        source: WEATHER_SOURCE,
        minzoom: 8,
        filter: ["has", "temp"],
        layout: {
          "text-field": ["concat", ["to-string", ["round", ["get", "temp"]]], "°"],
          "text-font": ["Frutiger Neue Condensed Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 12, 14],
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-allow-overlap": false,
          visibility: "none",
        },
        paint: {
          "text-color": ground.ink,
          "text-halo-color": ground.paper,
          "text-halo-width": 1.2,
        },
      });
    },
    update(map, weather) {
      (map.getSource(WEATHER_SOURCE) as GeoJSONSource | undefined)?.setData(
        stationsToGeoJSON(weather),
      );
    },
    setPresence(map, presence) {
      show(map, LAYER_CIRCLES, presence !== "off");
      show(map, LAYER_LABELS, presence === "full");
    },
  };
}

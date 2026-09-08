import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { HydrologyState } from "@swiss-now/core";
import { ground, layerAccent } from "@swiss-now/motion/tokens";
import { hydroToGeoJSON, riverWidthExpression } from "@/lib/map/hydro-geojson";
import { show, type MapContribution } from "./types";

export const HYDRO_SOURCE = "hydro-stations";
export const LAYER_HYDRO = "hydro-circles";
export const LAYER_HYDRO_LABELS = "hydro-labels";
export const LAYER_RIVERS = "rivers-flow";

/**
 * Rivers redrawn from the basemap's waterway lines with width from current discharge and an
 * animated dash that reads as flow (docs/MOTION_SYSTEM.md: RiverFlow), plus gauging stations
 * coloured by flood danger. Quiet presence keeps only danger ≥ 2 stations and fainter rivers.
 */
export function waterContribution(
  initial: HydrologyState | undefined,
): MapContribution<HydrologyState> {
  let raf = 0;
  return {
    id: "water",
    layer: "hydrology",
    hoverLayers: [LAYER_HYDRO],
    install(map, { beforeId }) {
      map.addLayer(
        {
          id: LAYER_RIVERS,
          type: "line",
          source: "base_v1.0.0",
          "source-layer": "waterway",
          minzoom: 6,
          filter: [
            "all",
            ["!=", ["get", "intermittent"], 1],
            [
              "!",
              [
                "in",
                ["get", "class"],
                ["literal", ["riverbank", "shoreline", "shoreline_changing_level"]],
              ],
            ],
          ],
          layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
          paint: {
            "line-color": layerAccent.hydrology,
            "line-width": (initial ? riverWidthExpression(initial) : 0.8) as never,
            "line-opacity": 0.85,
            "line-dasharray": [0, 3, 3],
          },
        },
        beforeId,
      );
      map.addSource(HYDRO_SOURCE, {
        type: "geojson",
        data: initial ? hydroToGeoJSON(initial) : { type: "FeatureCollection", features: [] },
        promoteId: "id",
      });
      map.addLayer({
        id: LAYER_HYDRO,
        type: "circle",
        source: HYDRO_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-color": [
            "case",
            [">=", ["get", "danger"], 2],
            [
              "interpolate",
              ["linear"],
              ["get", "danger"],
              2,
              "#E3D26F",
              3,
              "#E8A23A",
              4,
              "#D9552B",
              5,
              "#8E1B1B",
            ],
            layerAccent.hydrology,
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            [
              "case",
              ["has", "discharge"],
              [
                "interpolate",
                ["linear"],
                ["log10", ["max", 1, ["get", "discharge"]]],
                0,
                2.5,
                3,
                6,
              ],
              3,
            ],
            10,
            [
              "case",
              ["has", "discharge"],
              ["interpolate", ["linear"], ["log10", ["max", 1, ["get", "discharge"]]], 0, 5, 3, 12],
              6,
            ],
          ],
          "circle-stroke-color": ground.paper,
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1],
          "circle-opacity": 0.95,
        },
      });
      map.addLayer({
        id: LAYER_HYDRO_LABELS,
        type: "symbol",
        source: HYDRO_SOURCE,
        minzoom: 8.5,
        filter: ["has", "discharge"],
        layout: {
          visibility: "none",
          "text-field": ["concat", ["to-string", ["round", ["get", "discharge"]]], " m³/s"],
          "text-font": ["Frutiger Neue Condensed Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8.5, 11, 12, 13],
          "text-offset": [0, 1.1],
          "text-anchor": "top",
        },
        paint: {
          "text-color": layerAccent.hydrology,
          "text-halo-color": ground.paper,
          "text-halo-width": 1.2,
        },
      });
      startFlow(map);
    },
    update(map, hydrology) {
      (map.getSource(HYDRO_SOURCE) as GeoJSONSource | undefined)?.setData(
        hydroToGeoJSON(hydrology),
      );
      map.setPaintProperty(LAYER_RIVERS, "line-width", riverWidthExpression(hydrology) as never);
    },
    setPresence(map, presence) {
      const on = presence !== "off";
      show(map, LAYER_RIVERS, on);
      show(map, LAYER_HYDRO, on);
      show(map, LAYER_HYDRO_LABELS, presence === "full");
      if (map.getLayer(LAYER_HYDRO))
        map.setFilter(LAYER_HYDRO, presence === "quiet" ? [">=", ["get", "danger"], 2] : null);
      if (map.getLayer(LAYER_RIVERS))
        map.setPaintProperty(LAYER_RIVERS, "line-opacity", presence === "quiet" ? 0.45 : 0.85);
    },
  };

  // flow animation: cycle the dash pattern (dasharray cannot be data-driven or transitioned)
  function startFlow(map: MapLibreMap) {
    const dashSeq: [number, number, number][] = [
      [0, 3, 3],
      [0.5, 3, 2.5],
      [1, 3, 2],
      [1.5, 3, 1.5],
      [2, 3, 1],
      [2.5, 3, 0.5],
      [3, 3, 0],
      [0, 0.5, 3, 2.5],
      [0, 1, 3, 2],
      [0, 1.5, 3, 1.5],
      [0, 2, 3, 1],
      [0, 2.5, 3, 0.5],
    ] as never;
    let phase = 0;
    let last = 0;
    const tick = (now: number) => {
      if (!map.getStyle()) return;
      if (now - last > 90 && map.getLayoutProperty(LAYER_RIVERS, "visibility") === "visible") {
        last = now;
        phase = (phase + 1) % dashSeq.length;
        map.setPaintProperty(LAYER_RIVERS, "line-dasharray", dashSeq[phase]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    map.once("remove", () => cancelAnimationFrame(raf));
  }
}

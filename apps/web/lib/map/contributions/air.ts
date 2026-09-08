import type { GeoJSONSource } from "maplibre-gl";
import type { AirState } from "@swiss-now/core";
import { ground, layerAccent } from "@swiss-now/motion/tokens";
import { colorExpression } from "@/lib/map/expressions";
import { show, type MapContribution } from "./types";

export const AIR_SOURCE = "air-stations";
export const LAYER_AIR = "air-circles";
export const LAYER_AIR_CITIZEN = "air-citizen";
export const POLLEN_SOURCE = "pollen-stations";
export const LAYER_POLLEN = "pollen-circles";

export interface AirFeatureProps {
  id: string;
  name: string;
  tier: "reference" | "citizen";
  air: true;
  index?: number;
  pm25?: number;
  pm10?: number;
  no2?: number;
  o3?: number;
  observedAt?: string;
}
export interface PollenFeatureProps {
  id: string;
  name: string;
  pollen: true;
  top?: string;
  value?: number;
  observedAt?: string;
}

function airGeoJson(a: AirState): GeoJSON.FeatureCollection {
  const latest = new Map<string, Partial<AirFeatureProps>>();
  for (const o of a.observations) {
    const p = latest.get(o.stationId) ?? {};
    if (
      o.parameter === "pm25" ||
      o.parameter === "pm10" ||
      o.parameter === "no2" ||
      o.parameter === "o3"
    ) {
      p[o.parameter] = o.value;
      if (!p.observedAt || p.observedAt < o.observedAt) p.observedAt = o.observedAt;
    }
    latest.set(o.stationId, p);
  }
  return {
    type: "FeatureCollection",
    features: a.stations.map((s) => {
      const props: AirFeatureProps = {
        id: s.id,
        name: s.name.en ?? s.name.de,
        tier: s.tier ?? "reference",
        air: true,
        ...latest.get(s.id),
      };
      const idx = a.indexByStation[s.id];
      if (idx !== undefined) props.index = idx;
      return {
        type: "Feature",
        id: s.id,
        geometry: { type: "Point", coordinates: s.lonLat },
        properties: props,
      };
    }),
  };
}

function pollenGeoJson(a: AirState): GeoJSON.FeatureCollection {
  const top = new Map<string, { top: string; value: number; observedAt: string }>();
  for (const o of a.pollen.observations) {
    const t = top.get(o.stationId);
    if (!t || o.value > t.value)
      top.set(o.stationId, { top: o.parameter, value: o.value, observedAt: o.observedAt });
  }
  return {
    type: "FeatureCollection",
    features: a.pollen.stations.map((s) => ({
      type: "Feature",
      id: s.id,
      geometry: { type: "Point", coordinates: s.lonLat },
      properties: {
        id: s.id,
        name: s.name.en ?? s.name.de,
        pollen: true,
        ...top.get(s.id),
      } satisfies PollenFeatureProps,
    })),
  };
}

/** Reference stations as filled circles on the index ramp, citizen sensors hollow, pollen as green marks. */
export function airContribution(initial: AirState | undefined): MapContribution<AirState> {
  const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  return {
    id: "air",
    layer: "air",
    hoverLayers: [LAYER_AIR, LAYER_AIR_CITIZEN, LAYER_POLLEN],
    install(map) {
      map.addSource(AIR_SOURCE, {
        type: "geojson",
        data: initial ? airGeoJson(initial) : empty,
        promoteId: "id",
      });
      map.addSource(POLLEN_SOURCE, {
        type: "geojson",
        data: initial ? pollenGeoJson(initial) : empty,
        promoteId: "id",
      });
      map.addLayer({
        id: LAYER_AIR_CITIZEN,
        type: "circle",
        source: AIR_SOURCE,
        filter: ["==", ["get", "tier"], "citizen"],
        layout: { visibility: "none" },
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 10, 5],
          "circle-stroke-color": [
            "case",
            ["has", "index"],
            colorExpression("index", "airIndex"),
            ground.graphite,
          ],
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1.2],
          "circle-stroke-opacity": 0.9,
        },
      });
      map.addLayer({
        id: LAYER_AIR,
        type: "circle",
        source: AIR_SOURCE,
        filter: ["==", ["get", "tier"], "reference"],
        layout: { visibility: "none" },
        paint: {
          "circle-color": [
            "case",
            ["has", "index"],
            colorExpression("index", "airIndex"),
            ground.mist,
          ],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 10, 11],
          "circle-stroke-color": ground.paper,
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1.5],
        },
      });
      map.addLayer({
        id: LAYER_POLLEN,
        type: "circle",
        source: POLLEN_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-color": "#8FB58A",
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "value"], 0],
            0,
            3,
            50,
            7,
            500,
            12,
          ],
          "circle-stroke-color": ground.paper,
          "circle-stroke-width": 1,
          "circle-opacity": ["case", [">", ["coalesce", ["get", "value"], 0], 0], 0.9, 0.35],
        },
      });
    },
    update(map, air) {
      (map.getSource(AIR_SOURCE) as GeoJSONSource | undefined)?.setData(airGeoJson(air));
      (map.getSource(POLLEN_SOURCE) as GeoJSONSource | undefined)?.setData(pollenGeoJson(air));
    },
    setPresence(map, presence) {
      show(map, LAYER_AIR, presence !== "off");
      show(map, LAYER_AIR_CITIZEN, presence === "full");
      show(map, LAYER_POLLEN, presence === "full");
      if (map.getLayer(LAYER_AIR))
        map.setFilter(
          LAYER_AIR,
          presence === "quiet"
            ? [
                "all",
                ["==", ["get", "tier"], "reference"],
                [">=", ["coalesce", ["get", "index"], 0], 4],
              ]
            : ["==", ["get", "tier"], "reference"],
        );
    },
  };
}
export const airAccent = layerAccent.air;

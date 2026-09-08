import type { GeoJSONSource, ImageSource } from "maplibre-gl";
import type { HazardsState } from "@swiss-now/core";
import { ground, layerAccent } from "@swiss-now/motion/tokens";
import { colorExpression } from "@/lib/map/expressions";
import { show, type MapContribution } from "./types";

export const FIRE_SOURCE = "hazard-fire-regions";
export const LAYER_FIRE = "hazard-fire-fill";
export const LAYER_FIRE_LINES = "hazard-fire-lines";
export const AVALANCHE_SOURCE = "hazard-avalanche-regions";
export const LAYER_AVALANCHE = "hazard-avalanche-fill";
export const SNOW_SOURCE = "hazard-snow-stations";
export const LAYER_SNOW = "hazard-snow-circles";
export const HAIL_SOURCE = "hazard-hail";
export const LAYER_HAIL = "hazard-hail-raster";

export interface RegionFeatureProps {
  id: string;
  level: number;
  name: string;
  canton?: string;
  region: "fire" | "avalanche";
}
export interface SnowFeatureProps {
  id: string;
  name: string;
  snow: true;
  depth?: number;
  temp?: number;
  elevation?: number;
  observedAt?: string;
}

function snowGeoJson(h: HazardsState): GeoJSON.FeatureCollection {
  const by = new Map<string, Partial<SnowFeatureProps>>();
  for (const o of h.snow.observations) {
    const p = by.get(o.stationId) ?? {};
    if (o.parameter === "snowDepth") p.depth = o.value;
    if (o.parameter === "airTemperature") p.temp = o.value;
    p.observedAt = o.observedAt;
    by.set(o.stationId, p);
  }
  return {
    type: "FeatureCollection",
    features: h.snow.stations.map((s) => ({
      type: "Feature",
      id: s.id,
      geometry: { type: "Point", coordinates: s.lonLat },
      properties: {
        id: s.id,
        name: s.name.en ?? s.name.de,
        snow: true,
        ...(s.elevation !== undefined ? { elevation: s.elevation } : {}),
        ...by.get(s.id),
      } satisfies SnowFeatureProps,
    })),
  };
}

const CORNERS = (
  b: [number, number, number, number],
): [[number, number], [number, number], [number, number], [number, number]] => [
  [b[0], b[3]],
  [b[2], b[3]],
  [b[2], b[1]],
  [b[0], b[1]],
];

/**
 * Forest-fire and avalanche regions as translucent fills on the danger ramp (loaded once from the
 * region routes), IMIS snow stations as circles, and the hail product as an image on the radar plate.
 */
export function hazardsContribution(
  initial: HazardsState | undefined,
): MapContribution<HazardsState> {
  let regionsLoaded = false;
  let hailShown: string | undefined;
  const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  return {
    id: "hazards",
    layer: "hazards",
    hoverLayers: [LAYER_FIRE, LAYER_AVALANCHE, LAYER_SNOW],
    install(map, { beforeId }) {
      map.addSource(FIRE_SOURCE, { type: "geojson", data: empty, promoteId: "id" });
      map.addSource(AVALANCHE_SOURCE, { type: "geojson", data: empty, promoteId: "id" });
      map.addSource(SNOW_SOURCE, {
        type: "geojson",
        data: initial ? snowGeoJson(initial) : empty,
        promoteId: "id",
      });
      const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
      for (const [id, source, kind] of [
        [LAYER_FIRE, FIRE_SOURCE, "fire"],
        [LAYER_AVALANCHE, AVALANCHE_SOURCE, "avalanche"],
      ] as const) {
        map.addLayer(
          {
            id,
            type: "fill",
            source,
            layout: { visibility: "none" },
            paint: {
              "fill-color": colorExpression("level", "dangerLevel"),
              "fill-opacity": [
                "case",
                ["boolean", ["feature-state", "hover"], false],
                0.6,
                kind === "fire" ? 0.32 : 0.45,
              ],
            },
          },
          before,
        );
      }
      map.addLayer(
        {
          id: LAYER_FIRE_LINES,
          type: "line",
          source: FIRE_SOURCE,
          layout: { visibility: "none" },
          paint: { "line-color": ground.paper, "line-width": 0.6, "line-opacity": 0.8 },
        },
        before,
      );
      map.addLayer({
        id: LAYER_SNOW,
        type: "circle",
        source: SNOW_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-color": [
            "case",
            [">", ["coalesce", ["get", "depth"], 0], 0],
            "#5F7FB5",
            ground.mist,
          ],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["coalesce", ["get", "depth"], 0],
            0,
            2.5,
            100,
            6,
            300,
            10,
          ],
          "circle-stroke-color": ground.paper,
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1],
          "circle-opacity": 0.9,
        },
      });
      // region polygons are loaded once per session (an hour's cache on the routes)
      void Promise.all(
        (["fire", "avalanche"] as const).map((kind) =>
          fetch(`/api/hazards/regions/${kind}`)
            .then((r) => (r.ok ? r.json() : empty))
            .then((gj: GeoJSON.FeatureCollection) => {
              const withKind = {
                ...gj,
                features: (gj.features ?? []).map((f) => ({
                  ...f,
                  properties: { ...f.properties, region: kind },
                })),
              };
              (
                map.getSource(kind === "fire" ? FIRE_SOURCE : AVALANCHE_SOURCE) as
                  GeoJSONSource | undefined
              )?.setData(withKind);
            })
            .catch(() => {}),
        ),
      ).then(() => {
        regionsLoaded = true;
      });
    },
    update(map, h) {
      (map.getSource(SNOW_SOURCE) as GeoJSONSource | undefined)?.setData(snowGeoJson(h));
      const hail = h.hail;
      if (hail && hail.id !== hailShown) {
        const src = map.getSource(HAIL_SOURCE) as ImageSource | undefined;
        if (src) src.updateImage({ url: hail.imageUrl, coordinates: CORNERS(hail.bounds) });
        else {
          map.addSource(HAIL_SOURCE, {
            type: "image",
            url: hail.imageUrl,
            coordinates: CORNERS(hail.bounds),
          });
          map.addLayer({
            id: LAYER_HAIL,
            type: "raster",
            source: HAIL_SOURCE,
            paint: { "raster-opacity": 0.85, "raster-fade-duration": 0 },
          });
        }
        hailShown = hail.id;
      }
      if (!hail && map.getLayer(LAYER_HAIL))
        map.setLayoutProperty(LAYER_HAIL, "visibility", "none");
    },
    setPresence(map, presence) {
      const on = presence !== "off";
      show(map, LAYER_FIRE, on);
      show(map, LAYER_FIRE_LINES, presence === "full");
      show(map, LAYER_AVALANCHE, on);
      show(map, LAYER_SNOW, presence === "full");
      if (map.getLayer(LAYER_HAIL)) show(map, LAYER_HAIL, on);
      // NOW: only regions at level 3 or more
      if (map.getLayer(LAYER_FIRE))
        map.setFilter(LAYER_FIRE, presence === "quiet" ? [">=", ["get", "level"], 3] : null);
      if (map.getLayer(LAYER_AVALANCHE))
        map.setFilter(LAYER_AVALANCHE, presence === "quiet" ? [">=", ["get", "level"], 3] : null);
      void regionsLoaded;
    },
  };
}
export const hazardsAccent = layerAccent.hazards;

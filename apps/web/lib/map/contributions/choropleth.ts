import type { Map as MapLibreMap } from "maplibre-gl";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { LayerId } from "@swiss-now/core";
import { ground, scaleStops, type ScaleStopsKey } from "@swiss-now/motion/tokens";
import { show, type MapContribution } from "./types";

export interface ChoroplethCell {
  value: number | null;
  /** extra numbers shown in the hover card (e.g. turnout) */
  [k: string]: number | null;
}
export type ChoroplethState = Record<string, ChoroplethCell>;

export interface ChoroplethOptions {
  id: string;
  layer: LayerId;
  /** TopoJSON with `municipalities`, `cantons` (and `lakes`) objects; ids are BFS numbers / codes. */
  topoUrl: string;
  scale: ScaleStopsKey;
  /** merged into hovered features: label, unit, source */
  hoverExtras?: Record<string, unknown>;
}

/**
 * Municipality choropleth on the geo spine: the polygons are loaded once, values arrive as
 * feature-state (no geometry re-upload when the indicator or vote changes). Missing values stay
 * transparent; canton borders are drawn as ink hairlines above the fill.
 */
export function choroplethContribution(o: ChoroplethOptions): MapContribution<ChoroplethState> {
  const SRC = `${o.id}-municipalities`;
  const SRC_CANTONS = `${o.id}-cantons`;
  const FILL = `${o.id}-fill`;
  const LINES = `${o.id}-lines`;
  const CANTONS = `${o.id}-canton-lines`;
  let loaded = false;
  let pending: ChoroplethState | undefined;
  let visible = false;
  let applied = new Set<string>();
  const stops = scaleStops[o.scale].flatMap(([v, c]) => [v, c]);

  const apply = (map: MapLibreMap, state: ChoroplethState) => {
    const next = new Set<string>();
    for (const [id, cell] of Object.entries(state)) {
      map.setFeatureState({ source: SRC, id: Number(id) }, cell);
      next.add(id);
    }
    for (const id of applied)
      if (!next.has(id)) map.removeFeatureState({ source: SRC, id: Number(id) });
    applied = next;
  };

  return {
    id: o.id,
    layer: o.layer,
    hoverLayers: [FILL],
    ...(o.hoverExtras ? { hoverExtras: o.hoverExtras } : {}),
    install(map, { beforeId }) {
      void fetch(o.topoUrl)
        .then((r) => r.json())
        .then((topo: Topology) => {
          if (!map.getStyle()) return;
          const munis = feature(topo, topo.objects["municipalities"] as GeometryCollection);
          const cantons = feature(topo, topo.objects["cantons"] as GeometryCollection);
          map.addSource(SRC, { type: "geojson", data: munis });
          map.addSource(SRC_CANTONS, { type: "geojson", data: cantons });
          const before = beforeId && map.getLayer(beforeId) ? beforeId : undefined;
          map.addLayer(
            {
              id: FILL,
              type: "fill",
              source: SRC,
              layout: { visibility: "none" },
              paint: {
                "fill-color": [
                  "case",
                  ["==", ["feature-state", "value"], null],
                  "rgba(0,0,0,0)",
                  ["interpolate", ["linear"], ["feature-state", "value"], ...stops],
                ] as never,
                "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.82],
                "fill-color-transition": { duration: 240, delay: 0 },
              },
            },
            before,
          );
          map.addLayer(
            {
              id: LINES,
              type: "line",
              source: SRC,
              minzoom: 9,
              layout: { visibility: "none" },
              paint: { "line-color": ground.paper, "line-width": 0.5, "line-opacity": 0.7 },
            },
            before,
          );
          map.addLayer(
            {
              id: CANTONS,
              type: "line",
              source: SRC_CANTONS,
              layout: { visibility: "none" },
              paint: {
                "line-color": ground.ink,
                "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 10, 1.2],
                "line-opacity": 0.8,
              },
            },
            before,
          );
          loaded = true;
          if (pending) apply(map, pending);
          show(map, FILL, visible);
          show(map, LINES, visible);
          show(map, CANTONS, visible);
        })
        .catch(() => {
          // no polygons: the topic still shows its figures
        });
    },
    update(map, state) {
      pending = state;
      if (loaded) apply(map, state);
    },
    setPresence(map, presence) {
      const on = presence === "full";
      visible = on;
      if (!loaded) return;
      show(map, FILL, on);
      show(map, LINES, on);
      show(map, CANTONS, on);
    },
  };
}

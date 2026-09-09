import type { ExpressionSpecification, GeoJSONSource } from "maplibre-gl";
import type { EnergyState, GenerationType, PowerPlantType } from "@swiss-now/core";
import { ground, plantType } from "@swiss-now/motion/tokens";
import type { EnergySites } from "@/lib/use-energy-sites";
import { show, type MapContribution } from "./types";

export const PLANTS_SOURCE = "energy-plants";
export const GRID_SOURCE = "energy-grid";
export const LAYER_GRID = "energy-grid-lines";
export const LAYER_PLANTS = "energy-plants-circles";
export const LAYER_PLANTS_HALO = "energy-plants-halo";

export interface PlantFeatureProps {
  plant: true;
  id: string;
  name: string;
  municipality: string;
  canton: string;
  type: PowerPlantType;
  kw: number;
  since?: number;
}

export interface EnergySitesUpdate {
  sites: EnergySites | undefined;
  energy: EnergyState | undefined;
}

/** How the hourly national mix maps onto plant types (the mix knows no storage/run split). */
const MIX_OF: Record<PowerPlantType, GenerationType | undefined> = {
  "hydro-storage": "reservoir",
  "hydro-pumped": "pumpedStorage",
  "hydro-run": "runOfRiver",
  nuclear: "nuclear",
  solar: "solar",
  wind: "wind",
  biomass: "others",
  waste: "others",
  gas: "others",
  other: "others",
};

function plantsGeoJson(sites: EnergySites): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sites.plants.plants.map((p) => {
      const props: PlantFeatureProps = {
        plant: true,
        id: p.id,
        name: p.name,
        municipality: p.municipality,
        canton: p.canton,
        type: p.type,
        kw: p.kw,
      };
      if (p.since !== undefined) props.since = p.since;
      return {
        type: "Feature",
        id: p.id,
        geometry: { type: "Point", coordinates: p.lonLat },
        properties: props,
      };
    }),
  };
}

/**
 * Activity per type: the type's current national output against the installed power of the
 * plants we show (the register's ≥ 1 MW set). 1 = running at that capacity. Solar peaks at noon,
 * storage hydro in the evening, nuclear stays near 1.
 */
export function typeActivity(
  sites: EnergySites | undefined,
  energy: EnergyState | undefined,
): Partial<Record<PowerPlantType, number>> {
  const out: Partial<Record<PowerPlantType, number>> = {};
  if (!sites || !energy?.generation) return out;
  const installed: Partial<Record<PowerPlantType, number>> = {};
  for (const p of sites.plants.plants) installed[p.type] = (installed[p.type] ?? 0) + p.kw / 1000;
  const mix = energy.generation.byTypeMW;
  for (const type of Object.keys(installed) as PowerPlantType[]) {
    const key = MIX_OF[type];
    const mw = key ? mix[key] : undefined;
    const cap = installed[type];
    if (mw === undefined || !cap) continue;
    // the register's capacity for small types (biomass, waste, gas) is well below the mix's "others"; cap at 1
    out[type] = Math.max(0, Math.min(1, mw / cap));
  }
  return out;
}

const colorByType = [
  "match",
  ["get", "type"],
  ...Object.entries(plantType).flatMap(([k, v]) => [k, v]),
  ground.mist,
] as unknown as ExpressionSpecification;

/** Plants ≥ 1 MW as circles by type and capacity, the 220/380 kV grid as hairlines. */
export function energySitesContribution(): MapContribution<EnergySitesUpdate> {
  let loaded = false;
  let visible = false;
  let breathe: ReturnType<typeof setInterval> | undefined;
  let phase = false;
  const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  const opacityFor = (activity: Partial<Record<PowerPlantType, number>>) =>
    [
      "match",
      ["get", "type"],
      ...(Object.keys(plantType) as PowerPlantType[]).flatMap((k) => [
        k,
        0.35 + 0.6 * (activity[k] ?? 0.5),
      ]),
      0.5,
    ] as unknown as ExpressionSpecification;
  return {
    id: "energy-sites",
    layer: "energy",
    hoverLayers: [LAYER_PLANTS],
    install(map, ctx) {
      map.addSource(GRID_SOURCE, { type: "geojson", data: empty });
      map.addSource(PLANTS_SOURCE, { type: "geojson", data: empty, promoteId: "id" });
      map.addLayer(
        {
          id: LAYER_GRID,
          type: "line",
          source: GRID_SOURCE,
          layout: { visibility: "none", "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ground.graphite,
            "line-width": ["match", ["get", "kv"], 380, 1.6, 0.9],
            "line-opacity": ["match", ["get", "kv"], 380, 0.55, 0.35],
          },
        },
        ctx.beforeId,
      );
      map.addLayer({
        id: LAYER_PLANTS_HALO,
        type: "circle",
        source: PLANTS_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-color": colorByType,
          "circle-opacity": 0.12,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            ["*", ["sqrt", ["/", ["get", "kw"], 1000]], 0.9],
            10,
            ["*", ["sqrt", ["/", ["get", "kw"], 1000]], 2.2],
          ],
          "circle-radius-transition": { duration: 2400, delay: 0 },
        },
      });
      map.addLayer({
        id: LAYER_PLANTS,
        type: "circle",
        source: PLANTS_SOURCE,
        layout: { visibility: "none" },
        paint: {
          "circle-color": colorByType,
          "circle-opacity": 0.85,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            ["+", 2.2, ["*", ["sqrt", ["/", ["get", "kw"], 1000]], 0.32]],
            10,
            ["+", 4, ["*", ["sqrt", ["/", ["get", "kw"], 1000]], 0.8]],
          ],
          "circle-stroke-color": ground.surface,
          "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1],
          "circle-opacity-transition": { duration: 900, delay: 0 },
        },
      });
      if (visible) [LAYER_GRID, LAYER_PLANTS_HALO, LAYER_PLANTS].forEach((l) => show(map, l, true));
    },
    update(map, { sites, energy }) {
      if (sites && !loaded) {
        (map.getSource(GRID_SOURCE) as GeoJSONSource | undefined)?.setData(
          sites.grid as unknown as GeoJSON.FeatureCollection,
        );
        (map.getSource(PLANTS_SOURCE) as GeoJSONSource | undefined)?.setData(plantsGeoJson(sites));
        loaded = true;
      }
      if (sites && energy && map.getLayer(LAYER_PLANTS))
        map.setPaintProperty(
          LAYER_PLANTS,
          "circle-opacity",
          opacityFor(typeActivity(sites, energy)),
        );
    },
    setPresence(map, presence) {
      visible = presence === "full";
      [LAYER_GRID, LAYER_PLANTS_HALO, LAYER_PLANTS].forEach((l) => show(map, l, visible));
      // the halo breathes slowly while the topic is open: a paint transition every 2.4 s
      if (breathe) clearInterval(breathe);
      breathe = undefined;
      if (visible && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const tick = () => {
          if (!map.getLayer(LAYER_PLANTS_HALO)) return;
          phase = !phase;
          const k = phase ? 1.35 : 0.9;
          map.setPaintProperty(LAYER_PLANTS_HALO, "circle-radius", [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            ["*", ["sqrt", ["/", ["get", "kw"], 1000]], 0.9 * k],
            10,
            ["*", ["sqrt", ["/", ["get", "kw"], 1000]], 2.2 * k],
          ]);
        };
        tick();
        breathe = setInterval(tick, 2400);
      }
    },
  };
}

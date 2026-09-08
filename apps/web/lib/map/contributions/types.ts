import type { Map as MapLibreMap } from "maplibre-gl";
import type { LayerId } from "@swiss-now/core";
import type { Presence } from "@swiss-now/core/topics";

/**
 * A topic's contribution to the map: installs its sources and layers once, pushes new state,
 * and renders itself in full, quietly (NOW composite) or not at all. LiveMap owns the style,
 * the camera and the shared hover handler; contributions own everything data-specific.
 */
export interface MapContribution<S = unknown> {
  id: string;
  layer: LayerId;
  /** Idempotent; called once after the style has loaded. `beforeId` = first symbol layer. */
  install(map: MapLibreMap, ctx: { beforeId: string | undefined }): void;
  update?(map: MapLibreMap, state: S): void;
  setPresence(map: MapLibreMap, presence: Presence): void;
  /** Layers whose features raise the shared hover card. */
  hoverLayers?: string[];
  /** Static fields merged into hovered features of those layers (what the values mean). */
  hoverExtras?: Record<string, unknown>;
}

export function show(map: MapLibreMap, id: string, on: boolean): void {
  if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
}

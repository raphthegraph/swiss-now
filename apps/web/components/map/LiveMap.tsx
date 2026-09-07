"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type ImageSource,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from "maplibre-gl";
import type { Point } from "geojson";
import type { Field, WeatherState } from "@swiss-now/core";
import { SWITZERLAND_BBOX } from "@swiss-now/motion/specs";
import { ground } from "@swiss-now/motion/tokens";
import { colorExpression } from "@/lib/map/expressions";
import { stationsToGeoJSON, type StationFeatureProps } from "@/lib/map/stations-geojson";
import { HoverCard, type Hovered } from "./HoverCard";

const STYLE_URL = "/map/swiss-now-light.json";
// Worker served as a static module (see scripts/copy-maplibre-worker.mjs) — bundlers mis-resolve import.meta.url.
setWorkerUrl("/map/vendor/maplibre-gl-worker.mjs");
const SOURCE = "weather-stations";
const RADAR_SOURCES = ["radar-a", "radar-b"] as const;
const RADAR_LAYERS = ["radar-rain-a", "radar-rain-b"] as const;
const RADAR_OPACITY = 0.78;
const RADAR_FADE_MS = 220;
const LAYER_CIRCLES = "weather-temp-circles";
const LAYER_LABELS = "weather-temp-labels";

/** MapLibre image sources take corners clockwise from the top-left. */
function fieldCorners([w, s, e, n]: [number, number, number, number]): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ];
}

/** Insert data rasters below the basemap's labels so place names stay legible. */
function firstSymbolLayerId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((l) => l.type === "symbol")?.id;
}

export interface LiveMapProps {
  weather: WeatherState;
  /** Radar frame to show; defaults to the newest in `weather.fields`. */
  radarFrame?: Field | undefined;
  /** Receives the map once its style has loaded (overlays such as WindParticles attach here). */
  onMapReady?: (map: MapLibreMap) => void;
  /** Called once per animation frame while the map renders; used by the FPS meter in Spike A. */
  onFrame?: (nowMs: number) => void;
}

/**
 * The stage. MapLibre GL owns the camera and the data layers (docs/MOTION_SYSTEM.md §1);
 * React owns the HUD around it. Temperature is encoded with the shared token scale.
 */
export function LiveMap({ weather, radarFrame, onFrame, onMapReady }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  /** index of the radar source currently visible */
  const activeRadar = useRef<0 | 1>(0);
  const shownFrameId = useRef<string | null>(null);

  // create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // MapLibre 6 requires WebGL2. Degrade honestly instead of taking the page down.
    const probe = document.createElement("canvas");
    if (!probe.getContext("webgl2")) {
      setUnsupported(
        "This browser has no WebGL2, so the live map cannot render here. The summary below is still live.",
      );
      return;
    }
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: STYLE_URL,
        bounds: SWITZERLAND_BBOX as [number, number, number, number],
        fitBoundsOptions: { padding: { top: 96, right: 48, bottom: 160, left: 48 } },
        minZoom: 6,
        maxZoom: 14,
        maxBounds: [
          [3.5, 44.5],
          [13.0, 49.0],
        ],
        attributionControl: { compact: true, customAttribution: "Source: MeteoSwiss" },
        fadeDuration: 150,
        canvasContextAttributes: { antialias: true },
      });
    } catch (e) {
      setUnsupported(`The map could not start: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    mapRef.current = map;

    map.on("load", () => {
      // precipitation radar: two alternating image sources so frame changes can crossfade
      const initial = radarFrame ?? weather.fields.find((f) => f.kind === "radar-rain-rate");
      if (initial) {
        RADAR_SOURCES.forEach((sourceId, i) => {
          map.addSource(sourceId, {
            type: "image",
            url: initial.imageUrl,
            coordinates: fieldCorners(initial.bounds),
          });
          map.addLayer(
            {
              id: RADAR_LAYERS[i]!,
              type: "raster",
              source: sourceId,
              paint: {
                "raster-opacity": i === 0 ? RADAR_OPACITY : 0,
                "raster-opacity-transition": { duration: RADAR_FADE_MS, delay: 0 },
                "raster-fade-duration": 0,
                "raster-resampling": "linear",
              },
            },
            firstSymbolLayerId(map),
          );
        });
        shownFrameId.current = initial.id;
      }
      map.addSource(SOURCE, { type: "geojson", data: stationsToGeoJSON(weather), promoteId: "id" });
      map.addLayer({
        id: LAYER_CIRCLES,
        type: "circle",
        source: SOURCE,
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
        source: SOURCE,
        minzoom: 8,
        filter: ["has", "temp"],
        layout: {
          "text-field": ["concat", ["to-string", ["round", ["get", "temp"]]], "°"],
          "text-font": ["Frutiger Neue Condensed Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 12, 14],
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": ground.ink,
          "text-halo-color": ground.paper,
          "text-halo-width": 1.2,
        },
      });

      let hoveredId: string | number | undefined;
      const onMove = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        if (hoveredId !== undefined && hoveredId !== f.id) {
          map.setFeatureState({ source: SOURCE, id: hoveredId }, { hover: false });
        }
        hoveredId = f.id;
        map.setFeatureState({ source: SOURCE, id: f.id as string }, { hover: true });
        map.getCanvas().style.cursor = "crosshair";
        const p = f.properties as StationFeatureProps;
        const coords = (f.geometry as Point).coordinates as [number, number];
        setHovered({ props: p, lonLat: coords, point: map.project(coords) });
      };
      const onLeave = () => {
        if (hoveredId !== undefined)
          map.setFeatureState({ source: SOURCE, id: hoveredId }, { hover: false });
        hoveredId = undefined;
        map.getCanvas().style.cursor = "";
        setHovered(null);
      };
      map.on("mousemove", LAYER_CIRCLES, onMove);
      map.on("mouseleave", LAYER_CIRCLES, onLeave);
      // keep the card anchored while the camera moves
      map.on("move", () => {
        setHovered((h) => (h ? { ...h, point: map.project(h.lonLat) } : h));
      });
      setReady(true);
      onMapReady?.(map);
    });

    if (onFrame) map.on("render", () => onFrame(performance.now()));

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; data updates flow through the effect below
  }, []);

  // push new data into the existing sources
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
    src?.setData(stationsToGeoJSON(weather));
  }, [weather, ready]);

  // crossfade to the requested radar frame
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const frame = radarFrame ?? weather.fields.find((f) => f.kind === "radar-rain-rate");
    if (!frame || frame.id === shownFrameId.current) return;
    const next: 0 | 1 = activeRadar.current === 0 ? 1 : 0;
    const src = map.getSource(RADAR_SOURCES[next]) as ImageSource | undefined;
    if (!src) return;
    src.updateImage({ url: frame.imageUrl, coordinates: fieldCorners(frame.bounds) });
    // let the new image decode before swapping opacities
    const swap = () => {
      map.setPaintProperty(RADAR_LAYERS[next], "raster-opacity", RADAR_OPACITY);
      map.setPaintProperty(RADAR_LAYERS[activeRadar.current], "raster-opacity", 0);
      activeRadar.current = next;
      shownFrameId.current = frame.id;
    };
    if (map.isSourceLoaded(RADAR_SOURCES[next])) swap();
    else map.once("sourcedata", swap);
  }, [radarFrame, weather.fields, ready]);

  return (
    <div className="map-root">
      <div ref={containerRef} className="map-canvas" aria-label="Map of Switzerland" role="img" />
      {unsupported ? (
        <div className="map-unsupported" role="status">
          <span className="label">Map unavailable</span>
          <p>{unsupported}</p>
        </div>
      ) : null}
      {hovered ? <HoverCard hovered={hovered} freshness={weather.freshness} /> : null}
    </div>
  );
}

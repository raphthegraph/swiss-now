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
import type { Field, HydrologyState, WeatherState } from "@swiss-now/core";
import { hydroToGeoJSON, riverWidthExpression } from "@/lib/map/hydro-geojson";
import type { ActiveLayer } from "@/lib/layers";
import { layerAccent, duration } from "@swiss-now/motion/tokens";
import { easeHouse } from "@swiss-now/motion/math";
import { SWITZERLAND_BBOX } from "@swiss-now/motion/specs";
import { ground } from "@swiss-now/motion/tokens";
import { colorExpression } from "@/lib/map/expressions";
import { stationsToGeoJSON, type StationFeatureProps } from "@/lib/map/stations-geojson";
import type { HydroFeatureProps } from "@/lib/map/hydro-geojson";
import { HoverCard, type Hovered } from "./HoverCard";
import { AnimatePresence, motion } from "motion/react";

const STYLE_URL = "/map/swiss-now-light.json";
// Worker served as a static module (see scripts/copy-maplibre-worker.mjs) — bundlers mis-resolve import.meta.url.
setWorkerUrl("/map/vendor/maplibre-gl-worker.mjs");
const SOURCE = "weather-stations";
const RADAR_SOURCES = ["radar-a", "radar-b"] as const;
const RADAR_LAYERS = ["radar-rain-a", "radar-rain-b"] as const;
const HYDRO_SOURCE = "hydro-stations";
const LAYER_HYDRO = "hydro-circles";
const LAYER_HYDRO_LABELS = "hydro-labels";
const LAYER_RIVERS = "rivers-flow";
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
  /** Camera target; changing it glides the camera with the house easing. `null` = whole country. */
  focus?: { lonLat: [number, number]; zoom: number; key: string } | null | undefined;
  hydrology?: HydrologyState | undefined;
  active: ActiveLayer;
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
export function LiveMap({
  weather,
  hydrology,
  active,
  focus,
  radarFrame,
  onFrame,
  onMapReady,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const dashPhase = useRef(0);
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

      // rivers: the basemap's waterway lines redrawn with width from current discharge and an
      // animated dash that reads as flow (docs/MOTION_SYSTEM.md: RiverFlow)
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
            "line-width": (hydrology ? riverWidthExpression(hydrology) : 0.8) as never,
            "line-opacity": 0.85,
            "line-dasharray": [0, 3, 3],
          },
        },
        firstSymbolLayerId(map),
      );

      // hydrology stations: squares distinguish water from the round weather stations
      map.addSource(HYDRO_SOURCE, {
        type: "geojson",
        data: hydrology ? hydroToGeoJSON(hydrology) : { type: "FeatureCollection", features: [] },
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

      // flow animation: cycle the dash pattern (dasharray cannot be data-driven or transitioned)
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
      let lastDash = 0;
      const animateFlow = (now: number) => {
        if (!mapRef.current) return;
        if (
          now - lastDash > 90 &&
          map.getLayoutProperty(LAYER_RIVERS, "visibility") === "visible"
        ) {
          lastDash = now;
          dashPhase.current = (dashPhase.current + 1) % dashSeq.length;
          map.setPaintProperty(LAYER_RIVERS, "line-dasharray", dashSeq[dashPhase.current]);
        }
        requestAnimationFrame(animateFlow);
      };
      requestAnimationFrame(animateFlow);

      let hoveredId: string | number | undefined;
      let hoveredSource: string = SOURCE;
      const onMove = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        const source = f.source;
        if (hoveredId !== undefined && hoveredId !== f.id) {
          map.setFeatureState({ source: hoveredSource, id: hoveredId }, { hover: false });
        }
        hoveredId = f.id;
        hoveredSource = source;
        map.setFeatureState({ source, id: f.id as string }, { hover: true });
        map.getCanvas().style.cursor = "crosshair";
        const p = f.properties as StationFeatureProps | HydroFeatureProps;
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
      map.on("mousemove", LAYER_HYDRO, onMove);
      map.on("mouseleave", LAYER_HYDRO, onLeave);
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

  // camera glide to the focus place (or back to the country)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || focus === undefined) return;
    if (focus === null) {
      map.fitBounds(SWITZERLAND_BBOX as [number, number, number, number], {
        padding: { top: 96, right: 48, bottom: 160, left: 48 },
        duration: duration.cameraGlide,
        easing: easeHouse,
      });
      return;
    }
    map.easeTo({
      center: focus.lonLat,
      zoom: focus.zoom,
      duration: duration.cameraGlide,
      easing: easeHouse,
    });
  }, [focus?.key, ready]);

  // hydrology updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !hydrology) return;
    (map.getSource(HYDRO_SOURCE) as GeoJSONSource | undefined)?.setData(hydroToGeoJSON(hydrology));
    map.setPaintProperty(LAYER_RIVERS, "line-width", riverWidthExpression(hydrology) as never);
  }, [hydrology, ready]);

  // layer visibility follows the rail: NOW = curated composite, others reduce to one system
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const show = (id: string, on: boolean) =>
      map.getLayer(id) && map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    const weatherOn = active === "now" || active === "weather";
    const waterOn = active === "now" || active === "water";
    show(LAYER_CIRCLES, weatherOn);
    show(LAYER_LABELS, active === "weather");
    RADAR_LAYERS.forEach((l) => show(l, weatherOn));
    show(LAYER_RIVERS, waterOn);
    show(LAYER_HYDRO, waterOn);
    show(LAYER_HYDRO_LABELS, active === "water");
    // in NOW only classified danger ≥ 2 stations and the largest rivers appear
    if (map.getLayer(LAYER_HYDRO)) {
      map.setFilter(LAYER_HYDRO, active === "now" ? [">=", ["get", "danger"], 2] : null);
    }
    if (map.getLayer(LAYER_RIVERS)) {
      map.setPaintProperty(LAYER_RIVERS, "line-opacity", active === "now" ? 0.45 : 0.85);
    }
  }, [active, ready]);

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
      <AnimatePresence>
        {hovered ? (
          <motion.div
            key="hover"
            className="hover-anchor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.hover / 1000 }}
          >
            <HoverCard hovered={hovered} freshness={weather.freshness} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useBufferState, useDelayRender } from "remotion";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import type { LonLat } from "@swiss-now/core";

export interface PlateCamera {
  center: LonLat;
  zoom: number;
}

export interface MapAssets {
  /** MapLibre style JSON (the forked swiss-now-light style). */
  styleUrl: string;
  /** MapLibre worker module served as a static file (bundlers mis-resolve import.meta.url). */
  workerUrl: string;
}

export interface FixedMapPlateProps {
  plate: PlateCamera;
  /** Changes when the renderer camera must jump (at chapter cuts); the jump waits for `idle`. */
  plateKey: string;
  plateW: number;
  plateH: number;
  /** CSS transform that moves the plate under the frame for the current camera. */
  transform: string;
  assets: MapAssets;
}

const TIMEOUT = 60_000;

/**
 * Fixed map plate (Remotion maps skill, render-stability.md): the renderer camera stays still within
 * a sequence and only the canvas moves with CSS translate + scale. At a cut the camera jumps once,
 * under the paper dip, and rendering (or Player playback) waits for the tiles.
 */
export function FixedMapPlate({
  plate,
  plateKey,
  plateW,
  plateH,
  transform,
  assets,
}: FixedMapPlateProps) {
  const container = useRef<HTMLDivElement>(null);
  const { delayRender, continueRender } = useDelayRender();
  const buffer = useBufferState();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const applied = useRef<string | null>(null);
  const [loadHandle] = useState(() =>
    delayRender("swiss-now map plate", { timeoutInMilliseconds: TIMEOUT }),
  );

  useEffect(() => {
    if (!container.current) return;
    setWorkerUrl(assets.workerUrl);
    const m = new MapLibreMap({
      container: container.current,
      style: assets.styleUrl,
      center: plate.center,
      zoom: plate.zoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      pixelRatio: 1,
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });
    applied.current = plateKey;
    m.on("load", () => {
      m.jumpTo({ center: plate.center, zoom: plate.zoom, bearing: 0, pitch: 0 });
      m.once("idle", () => {
        setMap(m);
        continueRender(loadHandle);
      });
    });
    // no m.remove() cleanup — it interferes with Remotion's render lifecycle (maps skill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map || applied.current === plateKey) return;
    applied.current = plateKey;
    const h = delayRender(`swiss-now plate ${plateKey}`, { timeoutInMilliseconds: TIMEOUT });
    const p = buffer.delayPlayback();
    map.jumpTo({ center: plate.center, zoom: plate.zoom, bearing: 0, pitch: 0 });
    map.once("idle", () => {
      continueRender(h);
      p.unblock();
    });
    // force an idle event even when the camera did not change (two national sequences in a row)
    map.triggerRepaint();
  }, [map, plateKey, plate.center, plate.zoom, delayRender, continueRender, buffer]);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: plateW,
        height: plateH,
        transform,
        transformOrigin: "0 0",
        overflow: "hidden",
      }}
    >
      <div ref={container} style={{ width: plateW, height: plateH }} />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { RailState } from "@swiss-now/core";
import { positionAlongTrip, pulseEnvelope } from "@swiss-now/motion/math";
import { delayColor, delayToPulseRadius } from "@swiss-now/motion/scales";
import { layerAccent, period } from "@swiss-now/motion/tokens";
import { RailPathStore } from "@/lib/map/rail-paths";

const DELAY_PULSE_SECONDS = 180;

/**
 * Trains as motion. Every position is interpolated from the schedule plus live delays with the
 * shared `positionAlongTrip()` — Switzerland publishes no vehicle positions — and drawn as soft,
 * elongated marks so they never read as GPS dots. Delays ≥ 3 min pulse in Swiss red.
 */
export function TrainLayer({
  map,
  rail,
  mode,
}: {
  map: MapLibreMap | null;
  rail: RailState | undefined;
  /** "full" = RAIL view (all trains + labels); "quiet" = NOW composite (faint trains, delays only pulse) */
  mode: "full" | "quiet";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const railRef = useRef(rail);
  const modeRef = useRef(mode);
  const storeRef = useRef<RailPathStore | null>(null);
  railRef.current = rail;
  modeRef.current = mode;

  useEffect(() => {
    if (rail && (!storeRef.current || rail.pathsUrl !== storeRef.current["baseUrl"]))
      storeRef.current = new RailPathStore(rail.pathsUrl);
  }, [rail?.pathsUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const { clientWidth, clientHeight } = map.getContainer();
      canvas.width = Math.round(clientWidth * dpr);
      canvas.height = Math.round(clientHeight * dpr);
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      const state = railRef.current;
      const store = storeRef.current;
      if (!state || !store) return;
      const quiet = modeRef.current === "quiet";
      const zoom = map.getZoom();
      const t = Date.now();
      const len = Math.max(3, Math.min(14, (zoom - 5) * 2.2));
      const thick = Math.max(1.5, Math.min(5, (zoom - 5) * 0.8));

      for (const trip of state.activeTrips) {
        if (trip.cancelled) continue;
        const path = store.get(trip.pathId);
        if (!path) continue;
        const p = positionAlongTrip(trip, path, t);
        if (!p.active) continue;
        const pt = map.project(p.lonLat);
        if (pt.x < -20 || pt.y < -20 || pt.x > w + 20 || pt.y > h + 20) continue;
        const delayed = p.delaySeconds >= DELAY_PULSE_SECONDS;
        if (quiet && !delayed) {
          ctx.globalAlpha = 0.35;
        } else {
          ctx.globalAlpha = 0.95;
        }
        // delay pulse
        if (delayed) {
          const r = delayToPulseRadius(p.delaySeconds);
          const env = pulseEnvelope(nowMs, period.delayPulse, 1.6);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r * (0.6 + 0.6 * (1 - env)), 0, Math.PI * 2);
          ctx.strokeStyle = layerAccent.railDelay;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.7 * env;
          ctx.stroke();
          ctx.globalAlpha = 0.95;
        }
        // the train: a short capsule along the bearing
        const a = ((p.bearing - 90) * Math.PI) / 180;
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(a);
        ctx.fillStyle = delayed ? delayColor(p.delaySeconds) : layerAccent.rail;
        ctx.beginPath();
        ctx.roundRect(-len / 2, -thick / 2, len, thick, thick / 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };
    resize();
    map.on("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      map.off("resize", resize);
    };
  }, [map]);

  return <canvas ref={canvasRef} className="train-canvas" aria-hidden="true" />;
}

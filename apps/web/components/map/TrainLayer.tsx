"use client";

import { cancelFrame, nextFrame } from "@/lib/reduced-motion";
import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { RailState, TripSnapshot } from "@swiss-now/core";
import { positionAlongTrip, pulseEnvelope, type TripPosition } from "@swiss-now/motion/math";
import { delayColor } from "@swiss-now/motion/scales";
import { layerAccent, period } from "@swiss-now/motion/tokens";
import { RailPathStore } from "@/lib/map/rail-paths";

const DELAY_PULSE_SECONDS = 180;
const TRAIL_SAMPLES = 6;
const TRAIL_STEP_MS = 30_000;
const HIT_RADIUS_PX = 12;

export interface TrainHover {
  trip: TripSnapshot;
  position: TripPosition;
  point: { x: number; y: number };
}

export interface TrainLayerProps {
  map: MapLibreMap | null;
  rail: RailState | undefined;
  /** "full" = RAIL view (all trains, hover); "quiet" = NOW composite (faint trains, delays only pulse) */
  mode: "full" | "quiet";
  onHover?: (hover: TrainHover | null) => void;
  /** loaded route paths vs. paths needed, for the loading indicator */
  onProgress?: (loaded: number, needed: number) => void;
  /**
   * Display acceleration (RAIL view, off by the "real speed" switch): the clock the positions are
   * computed for runs ACCELERATION× faster over a short loop, so trains visibly travel their routes
   * at the national zoom. Marks are then ahead of the estimated real position; the legend says so.
   */
  accelerate?: boolean;
}

/** Acceleration at the national zoom; eases back to real time by zoom 10. */
export const ACCELERATION = 12;
const ACCEL_LOOP_MS = 45_000;
const ACCEL_FADE_MS = 700;

/**
 * Trains as motion. Every position is interpolated from the schedule plus live delays with the
 * shared `positionAlongTrip()` — Switzerland publishes no vehicle positions — and drawn as soft,
 * elongated marks so they never read as GPS dots. Delays ≥ 3 min pulse in Swiss red.
 */
export function TrainLayer({
  map,
  rail,
  mode,
  onHover,
  onProgress,
  accelerate = false,
}: TrainLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const railRef = useRef(rail);
  const modeRef = useRef(mode);
  const accelRef = useRef(accelerate);
  const anchorRef = useRef(Date.now());
  accelRef.current = accelerate;
  const storeRef = useRef<RailPathStore | null>(null);
  const [store, setStore] = useState<RailPathStore | null>(null);
  /** last drawn frame: screen positions for hit-testing */
  const drawnRef = useRef<{ trip: TripSnapshot; position: TripPosition; x: number; y: number }[]>(
    [],
  );
  const hoverRef = useRef(onHover);
  const progressRef = useRef(onProgress);
  railRef.current = rail;
  modeRef.current = mode;
  hoverRef.current = onHover;
  progressRef.current = onProgress;

  // one store per GTFS build; preload the active-path bundle as soon as we know the state
  useEffect(() => {
    if (!rail) return;
    if (!storeRef.current || rail.pathsUrl !== storeRef.current.baseUrl) {
      storeRef.current = new RailPathStore(rail.pathsUrl);
      setStore(storeRef.current);
    }
    void storeRef.current.preload("/api/rail/active-paths");
  }, [rail?.pathsUrl, rail?.gtfsBuild, rail?.observedAt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let dpr = 1;
    let lastProgress = "";
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
      raf = nextFrame(frame);
      if (document.hidden) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      const state = railRef.current;
      const s = storeRef.current;
      drawnRef.current = [];
      if (!state || !s) return;
      const quiet = modeRef.current === "quiet";
      const zoom = map.getZoom();
      // accelerated display clock: a short loop that runs ACCELERATION× and fades at the wrap
      const realNow = Date.now();
      const k = accelRef.current
        ? Math.max(1, ACCELERATION - (Math.max(0, zoom - 8) * (ACCELERATION - 1)) / 2)
        : 1;
      const elapsed = (realNow - anchorRef.current) % ACCEL_LOOP_MS;
      const t = k > 1 ? realNow + elapsed * (k - 1) : realNow;
      const wrapFade =
        k > 1 ? Math.min(1, elapsed / ACCEL_FADE_MS, (ACCEL_LOOP_MS - elapsed) / ACCEL_FADE_MS) : 1;
      // marks stay legible at national zoom and grow with zoom
      const len = Math.max(7, Math.min(18, 4 + (zoom - 6) * 3));
      const thick = Math.max(2.4, Math.min(6, 1.6 + (zoom - 6) * 0.9));
      let needed = 0;
      let loaded = 0;

      for (const trip of state.activeTrips) {
        if (trip.cancelled || trip.stops.filter((st) => !st.skipped).length < 2) continue;
        needed++;
        const path = s.get(trip.pathId);
        if (!path) continue;
        loaded++;
        const p = positionAlongTrip(trip, path, t);
        if (!p.active) continue;
        const pt = map.project(p.lonLat);
        if (pt.x < -20 || pt.y < -20 || pt.x > w + 20 || pt.y > h + 20) continue;
        const delayed = p.delaySeconds >= DELAY_PULSE_SECONDS;
        drawnRef.current.push({ trip, position: p, x: pt.x, y: pt.y });

        // delay pulse: a thin ring that breathes out from the train; radius grows with the delay
        if (delayed) {
          const minutes = p.delaySeconds / 60;
          const r = Math.min(22, 6 + Math.sqrt(minutes) * 3);
          const env = pulseEnvelope(nowMs, period.delayPulse, 1.6);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r * (0.45 + 0.55 * (1 - env)), 0, Math.PI * 2);
          ctx.strokeStyle = layerAccent.railDelay;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.55 * env * wrapFade;
          ctx.stroke();
        }
        // where the train was over the last three minutes: a tail along its real path, thinning into the past
        if (!quiet) {
          ctx.lineCap = "round";
          let from = pt;
          for (let k = 1; k <= TRAIL_SAMPLES; k++) {
            const past = positionAlongTrip(trip, path, t - k * TRAIL_STEP_MS);
            if (!past.active) break;
            const to = map.project(past.lonLat);
            const fade = 1 - (k - 1) / TRAIL_SAMPLES;
            ctx.globalAlpha = 0.4 * fade * wrapFade;
            ctx.lineWidth = Math.max(0.8, thick * 0.6 * fade);
            ctx.strokeStyle = delayed ? delayColor(p.delaySeconds) : layerAccent.rail;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            from = to;
          }
        }
        // the train: a short capsule along the bearing, with a paper halo so it stays visible on the ground
        ctx.globalAlpha = (quiet && !delayed ? 0.45 : 0.95) * wrapFade;
        const a = ((p.bearing - 90) * Math.PI) / 180;
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(a);
        ctx.fillStyle = "rgba(250,250,248,0.9)";
        ctx.beginPath();
        ctx.roundRect(-len / 2 - 1, -thick / 2 - 1, len + 2, thick + 2, thick);
        ctx.fill();
        ctx.fillStyle = delayed ? delayColor(p.delaySeconds) : layerAccent.rail;
        ctx.beginPath();
        ctx.roundRect(-len / 2, -thick / 2, len, thick, thick / 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // debug handle for QA scripts: last drawn screen positions
      (window as unknown as { __swissNowTrains?: unknown }).__swissNowTrains = drawnRef.current.map(
        (d) => ({
          x: d.x,
          y: d.y,
          line: d.trip.routeShortName,
          delay: d.position.delaySeconds,
        }),
      );
      const key = `${loaded}/${needed}`;
      if (key !== lastProgress) {
        lastProgress = key;
        progressRef.current?.(loaded, needed);
      }
    };

    // hover: nearest drawn train within a few pixels (the canvas itself ignores pointer events)
    const onMove = (e: { point: { x: number; y: number } }) => {
      if (modeRef.current !== "full") return;
      let best: (typeof drawnRef.current)[number] | undefined;
      let bestD = HIT_RADIUS_PX;
      for (const d of drawnRef.current) {
        const dist = Math.hypot(d.x - e.point.x, d.y - e.point.y);
        if (dist < bestD) {
          bestD = dist;
          best = d;
        }
      }
      map.getCanvas().style.cursor = best ? "crosshair" : "";
      hoverRef.current?.(
        best ? { trip: best.trip, position: best.position, point: { x: best.x, y: best.y } } : null,
      );
    };
    const onLeave = () => hoverRef.current?.(null);

    resize();
    map.on("resize", resize);
    map.on("mousemove", onMove);
    map.on("click", onMove);
    map.getCanvas().addEventListener("mouseleave", onLeave);
    raf = nextFrame(frame);
    return () => {
      cancelFrame(raf);
      map.off("resize", resize);
      map.off("mousemove", onMove);
      map.off("click", onMove);
      map.getCanvas().removeEventListener("mouseleave", onLeave);
    };
  }, [map]);

  void store;
  return <canvas ref={canvasRef} className="train-canvas" aria-hidden="true" />;
}

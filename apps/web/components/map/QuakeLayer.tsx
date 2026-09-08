"use client";

import { cancelFrame, nextFrame } from "@/lib/reduced-motion";
import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Event, SeismicState } from "@swiss-now/core";
import { ringProgress } from "@swiss-now/motion/math";
import { magnitudeToRings } from "@swiss-now/motion/scales";
import { layerAccent, period } from "@swiss-now/motion/tokens";

const HIT_RADIUS_PX = 14;
const DAY = 86_400_000;

export interface QuakeHover {
  event: Event;
  point: { x: number; y: number };
}

/** In NOW only notable, recent quakes pulse; in QUAKES every event of the window shows. */
export function isNotable(e: Event, nowMs: number): boolean {
  return (e.magnitude ?? 0) >= 2.5 && nowMs - new Date(e.startsAt).getTime() < DAY;
}

/**
 * Earthquakes as expanding rings whose count and reach follow the magnitude, fading with age over
 * the 30-day window. Reviewed catalogue: a quake appears hours after it happened, and the card says so.
 */
export function QuakeLayer({
  map,
  seismic,
  mode,
  onHover,
}: {
  map: MapLibreMap | null;
  seismic: SeismicState | undefined;
  mode: "full" | "quiet";
  onHover?: (h: QuakeHover | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(seismic);
  const modeRef = useRef(mode);
  const hoverRef = useRef(onHover);
  const drawnRef = useRef<{ event: Event; x: number; y: number }[]>([]);
  stateRef.current = seismic;
  modeRef.current = mode;
  hoverRef.current = onHover;

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
      raf = nextFrame(frame);
      if (document.hidden) return;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      drawnRef.current = [];
      const state = stateRef.current;
      if (!state) return;
      const quiet = modeRef.current === "quiet";
      const t = Date.now();
      const zoom = map.getZoom();
      const pxPerKm = (256 * Math.pow(2, zoom)) / 40_075 / Math.cos((46.8 * Math.PI) / 180);

      for (const e of state.events) {
        if (e.geometry.type !== "Point") continue;
        const notable = isNotable(e, t);
        if (quiet && !notable) continue;
        const m = e.magnitude ?? 0;
        const ageDays = (t - new Date(e.startsAt).getTime()) / DAY;
        const pt = map.project(e.geometry.coordinates as [number, number]);
        if (pt.x < -40 || pt.y < -40 || pt.x > w + 40 || pt.y > h + 40) continue;
        drawnRef.current.push({ event: e, x: pt.x, y: pt.y });
        const { rings, radiusKm } = magnitudeToRings(m);
        const maxR = Math.max(6, Math.min(80, radiusKm * pxPerKm));
        const ageFade = Math.max(0.25, 1 - ageDays / state.windowDays);
        // epicentre mark
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(2, 1.5 + m), 0, Math.PI * 2);
        ctx.fillStyle = layerAccent.seismic;
        ctx.globalAlpha = 0.9 * ageFade;
        ctx.fill();
        // rings: animated for recent events, static faint for older ones
        const animated = ageDays < 1 || notable;
        for (let i = 0; i < rings; i++) {
          let r: number;
          let opacity: number;
          if (animated) {
            const p = ringProgress(nowMs, period.quakeRing, i, rings);
            r = 4 + p.radius * maxR;
            opacity = p.opacity * 0.8;
          } else {
            r = 4 + ((i + 1) / rings) * maxR * 0.5;
            opacity = 0.25 * ageFade;
          }
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = layerAccent.seismic;
          ctx.lineWidth = animated ? 1.2 : 0.8;
          ctx.globalAlpha = opacity;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };
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
      hoverRef.current?.(best ? { event: best.event, point: { x: best.x, y: best.y } } : null);
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

  return <canvas ref={canvasRef} className="quake-canvas" aria-hidden="true" />;
}

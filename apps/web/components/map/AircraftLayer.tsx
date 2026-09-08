"use client";

import { cancelFrame, nextFrame } from "@/lib/reduced-motion";
import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { AviationState } from "@swiss-now/core";
import { fontFamily, ground, layerAccent } from "@swiss-now/motion/tokens";

export interface AircraftLayerProps {
  map: MapLibreMap | null;
  aviation: AviationState | undefined;
}

/**
 * Reported aircraft positions as chevrons rotated by track, with a stepped trail of the last
 * reports — deliberately not interpolated, unlike the trains (docs/IA.md §4). Canvas sibling.
 */
export function AircraftLayer({ map, aviation }: AircraftLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(aviation);
  const trails = useRef(new Map<string, [number, number][]>());
  stateRef.current = aviation;

  useEffect(() => {
    if (!aviation) return;
    const seen = new Set<string>();
    for (const a of aviation.aircraft) {
      seen.add(a.icao24);
      const t = trails.current.get(a.icao24) ?? [];
      const last = t[t.length - 1];
      if (!last || last[0] !== a.lonLat[0] || last[1] !== a.lonLat[1]) t.push(a.lonLat);
      trails.current.set(a.icao24, t.slice(-6));
    }
    for (const id of trails.current.keys()) if (!seen.has(id)) trails.current.delete(id);
  }, [aviation]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = true;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth: w, clientHeight: h } = map.getContainer();
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    map.on("resize", resize);
    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const s = stateRef.current;
      if (s) {
        ctx.font = `500 11px ${fontFamily.sans}`;
        const zoom = map.getZoom();
        for (const a of s.aircraft) {
          const p = map.project(a.lonLat);
          const alpha = a.onGround ? 0.35 : Math.min(1, 0.45 + (a.altitudeM ?? 0) / 12_000);
          const trail = trails.current.get(a.icao24) ?? [];
          ctx.save();
          ctx.globalAlpha = alpha * 0.5;
          ctx.strokeStyle = layerAccent.aviation;
          ctx.lineWidth = 1;
          ctx.beginPath();
          trail.forEach((ll, i) => {
            const q = map.project(ll);
            if (i === 0) ctx.moveTo(q.x, q.y);
            else ctx.lineTo(q.x, q.y);
          });
          ctx.stroke();
          ctx.globalAlpha = alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate((((a.trackDeg ?? 0) - 90) * Math.PI) / 180);
          const r = 6;
          ctx.fillStyle = layerAccent.aviation;
          ctx.strokeStyle = ground.paper;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(r * 1.4, 0);
          ctx.lineTo(-r, r * 0.8);
          ctx.lineTo(-r * 0.4, 0);
          ctx.lineTo(-r, -r * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          if (zoom >= 8 && a.callsign) {
            ctx.fillStyle = ground.ink;
            ctx.globalAlpha = alpha;
            ctx.fillText(a.callsign, p.x + 9, p.y + 4);
            ctx.globalAlpha = 1;
          }
        }
      }
      raf = nextFrame(draw);
    };
    raf = nextFrame(draw);
    return () => {
      running = false;
      cancelFrame(raf);
      map.off("resize", resize);
    };
  }, [map]);

  return <canvas ref={canvasRef} className="flow-canvas" aria-hidden="true" />;
}

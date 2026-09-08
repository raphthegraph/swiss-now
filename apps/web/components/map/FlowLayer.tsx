"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { BorderCode } from "@swiss-now/core";
import { flowDashOffset } from "@swiss-now/motion/math";
import { fontFamily, ground, layerAccent } from "@swiss-now/motion/tokens";
import { formatNumber } from "@/lib/format";

/** Where each border's flow enters or leaves the country (approximate crossing points). */
const ANCHORS: Record<BorderCode, { outside: [number, number]; inside: [number, number] }> = {
  DE: { outside: [8.55, 47.95], inside: [8.55, 47.58] },
  FR: { outside: [6.05, 46.95], inside: [6.55, 46.95] },
  AT: { outside: [9.85, 47.2], inside: [9.4, 47.2] },
  IT: { outside: [8.95, 45.75], inside: [8.95, 46.12] },
};
const MAX_WIDTH = 14;
const REF_MW = 3000;

export interface FlowLayerProps {
  map: MapLibreMap | null;
  /** anything with border flows: the live state or a stored snapshot summary */
  energy: { borderFlows: Partial<Record<BorderCode, number>> } | undefined;
  mode: "full" | "quiet";
}

/**
 * Electricity exchange with the neighbours: one arrow per border whose width and dash speed
 * follow the megawatts; the sign flips the direction (docs/MOTION_SYSTEM.md: EnergyFlow).
 * Canvas sibling of the map, projected each frame like the trains.
 */
export function FlowLayer({ map, energy, mode }: FlowLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const energyRef = useRef(energy);
  const modeRef = useRef(mode);
  energyRef.current = energy;
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    const draw = (now: number) => {
      if (!running) return;
      const e = energyRef.current;
      const quiet = modeRef.current === "quiet";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (e) {
        ctx.font = `500 ${quiet ? 11 : 13}px ${fontFamily.sans}`;
        for (const [code, mw] of Object.entries(e.borderFlows) as [BorderCode, number][]) {
          const a = ANCHORS[code];
          if (!a || !Number.isFinite(mw) || Math.abs(mw) < 1) continue;
          const imp = mw >= 0;
          const from = map.project(imp ? a.outside : a.inside);
          const to = map.project(imp ? a.inside : a.outside);
          const width = Math.max(2, (Math.min(Math.abs(mw), REF_MW) / REF_MW) * MAX_WIDTH);
          const speed = 20 + (Math.min(Math.abs(mw), REF_MW) / REF_MW) * 60;
          ctx.save();
          ctx.globalAlpha = quiet ? 0.45 : 0.9;
          ctx.strokeStyle = layerAccent.energy;
          ctx.lineWidth = width;
          ctx.lineCap = "round";
          ctx.setLineDash([width * 1.6, width * 1.2]);
          ctx.lineDashOffset = reduced ? 0 : flowDashOffset(now, speed, width * 2.8);
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
          // arrow head at the destination
          const ang = Math.atan2(to.y - from.y, to.x - from.x);
          const head = width * 1.4 + 6;
          ctx.setLineDash([]);
          ctx.fillStyle = layerAccent.energy;
          ctx.beginPath();
          ctx.moveTo(to.x + Math.cos(ang) * head * 0.6, to.y + Math.sin(ang) * head * 0.6);
          ctx.lineTo(to.x + Math.cos(ang + 2.5) * head, to.y + Math.sin(ang + 2.5) * head);
          ctx.lineTo(to.x + Math.cos(ang - 2.5) * head, to.y + Math.sin(ang - 2.5) * head);
          ctx.closePath();
          ctx.fill();
          // label at the outside end
          const label = `${code} ${imp ? "→" : "←"} ${formatNumber(Math.abs(mw), 0)} MW`;
          const lp = map.project(a.outside);
          const tw = ctx.measureText(label).width;
          const lx = Math.min(Math.max(lp.x - tw / 2, 8), canvas.clientWidth - tw - 8);
          const ly = code === "DE" ? lp.y - 14 : code === "IT" ? lp.y + 22 : lp.y - 16;
          ctx.globalAlpha = quiet ? 0.7 : 1;
          ctx.fillStyle = ground.paper;
          ctx.fillRect(lx - 4, ly - 12, tw + 8, 17);
          ctx.fillStyle = ground.ink;
          ctx.fillText(label, lx, ly);
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      map.off("resize", resize);
    };
  }, [map]);

  return <canvas ref={canvasRef} className="flow-canvas" aria-hidden="true" />;
}

"use client";

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { WeatherState } from "@swiss-now/core";
import {
  buildWindGrid,
  createParticles,
  seededRandom,
  stepParticles,
  type WindGrid,
  type WindSample,
} from "@swiss-now/motion/math";
import { windParticleDensity } from "@swiss-now/motion/scales";
import { ground, layerAccent } from "@swiss-now/motion/tokens";
import { SWITZERLAND_BBOX } from "@swiss-now/motion/specs";

const MAX_PARTICLES_DESKTOP = 3500;
const MAX_PARTICLES_MOBILE = 1400;
const TRAIL_FADE = 0.92; // per frame; lower = shorter trails

/** Builds wind samples from the latest gust + direction observations per station. */
export function windSamplesFromState(state: WeatherState): WindSample[] {
  const speed = new Map<string, number>();
  const dir = new Map<string, number>();
  for (const o of state.observations) {
    if (o.parameter === "windSpeed") speed.set(o.stationId, o.value);
    if (o.parameter === "windDirection") dir.set(o.stationId, o.value);
  }
  const samples: WindSample[] = [];
  for (const s of state.stations) {
    const sp = speed.get(s.id);
    const d = dir.get(s.id);
    if (sp === undefined || d === undefined) continue;
    samples.push({ lonLat: s.lonLat, speedKmh: sp, directionDeg: d });
  }
  return samples;
}

/**
 * Wind as motion: particles advected through a field interpolated from SwissMetNet stations,
 * drawn on a 2D canvas over the map (docs/MOTION_SYSTEM.md §3). Pauses when the tab is hidden and
 * respects prefers-reduced-motion. The math is shared with the Remotion target.
 */
export function WindParticles({
  map,
  weather,
  emphasis = "quiet",
}: {
  map: MapLibreMap | null;
  weather: WeatherState;
  /** full: the AIR and WEATHER topics show the wind itself (more particles, longer, darker trails) */
  emphasis?: "quiet" | "full";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<WindGrid | null>(null);
  const samplesRef = useRef<WindSample[]>([]);

  // rebuild the field whenever observations change
  useEffect(() => {
    const samples = windSamplesFromState(weather);
    samplesRef.current = samples;
    gridRef.current = samples.length >= 3 ? buildWindGrid(samples, SWITZERLAND_BBOX, 64, 40) : null;
  }, [weather]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const full = emphasis === "full";
    const maxParticles = Math.round(
      (isMobile ? MAX_PARTICLES_MOBILE : MAX_PARTICLES_DESKTOP) * (full ? 1.25 : 1),
    );
    const trailFade = full ? 0.945 : TRAIL_FADE;
    const rng = seededRandom(Date.now());
    let particles = createParticles(maxParticles, SWITZERLAND_BBOX, rng() * 1e9);
    let prev = new Float32Array(particles.length);
    let raf = 0;
    let last = performance.now();
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const { clientWidth, clientHeight } = map.getContainer();
      canvas.width = Math.round(clientWidth * dpr);
      canvas.height = Math.round(clientHeight * dpr);
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, clientWidth, clientHeight);
    };
    const clear = () => ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const grid = gridRef.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!grid || document.hidden) return;

      // density follows the mean wind: calm days show few particles
      const density = 0.25 + 0.75 * windParticleDensity(grid.meanSpeed * 3.6);
      const active = Math.floor((maxParticles * density) / 1) * 3;

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      // fade the previous frame → trails
      ctx.save();
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = `rgba(0,0,0,${trailFade})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      prev.set(particles);
      stepParticles(particles, grid, {
        dtSeconds: dt,
        rng,
        timeScale: 700 * Math.pow(2, 7 - map.getZoom()),
      });

      ctx.lineWidth = full ? 1.4 : 1.1;
      ctx.lineCap = "round";
      ctx.strokeStyle = layerAccent.wind;
      ctx.globalAlpha = full ? 0.5 : 0.55;
      ctx.beginPath();
      for (let i = 0; i < active; i += 3) {
        if (particles[i + 2]! === 0) continue; // just respawned: no segment
        const a = map.project([prev[i]!, prev[i + 1]!]);
        const b = map.project([particles[i]!, particles[i + 1]!]);
        if (b.x < 0 || b.y < 0 || b.x > w || b.y > h) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // full emphasis: an arrow per station, length by speed, creeping forward so the wind reads as motion
      if (full) {
        const zoom = map.getZoom();
        const scale = Math.max(0.8, Math.min(1.8, 0.6 + (zoom - 6) * 0.35));
        const creep = ((now / 1800) % 1) * 4;
        ctx.lineWidth = 1.2;
        ctx.lineJoin = "round";
        ctx.strokeStyle = ground.graphite;
        ctx.fillStyle = ground.graphite;
        for (const s of samplesRef.current) {
          // calm stations stay quiet; the arrows mark where the wind actually blows
          if (s.speedKmh < 8) continue;
          const p = map.project(s.lonLat);
          if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) continue;
          const len = Math.min(26, 8 + s.speedKmh * 0.4) * scale;
          const to = ((s.directionDeg + 180) * Math.PI) / 180; // meteorological FROM → TO
          const dx = Math.sin(to),
            dy = -Math.cos(to);
          const x0 = p.x - (dx * len) / 2 + dx * creep,
            y0 = p.y - (dy * len) / 2 + dy * creep;
          const x1 = x0 + dx * len,
            y1 = y0 + dy * len;
          ctx.globalAlpha = Math.min(0.7, 0.25 + s.speedKmh / 80);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          const head = 3 * scale;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 - dx * head * 1.8 - dy * head, y1 - dy * head * 1.8 + dx * head);
          ctx.lineTo(x1 - dx * head * 1.8 + dy * head, y1 - dy * head * 1.8 - dx * head);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };

    resize();
    map.on("resize", resize);
    map.on("movestart", clear);
    map.on("move", clear);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      map.off("resize", resize);
      map.off("movestart", clear);
      map.off("move", clear);
    };
  }, [map, emphasis]);

  return <canvas ref={canvasRef} className="wind-canvas" aria-hidden="true" />;
}

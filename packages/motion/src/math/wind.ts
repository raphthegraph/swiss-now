/**
 * Wind field from station observations and deterministic particle advection.
 * Pure functions of inputs and time — the web steps them per animation frame, Remotion per video
 * frame with a fixed seed, and both draw identical motion for identical inputs.
 */
import type { LonLat } from "@swiss-now/core";
import { seededRandom } from "./random";

export interface WindSample {
  lonLat: LonLat;
  /** km/h */
  speedKmh: number;
  /** meteorological direction the wind blows FROM, degrees clockwise from north */
  directionDeg: number;
}

export interface WindGrid {
  bounds: readonly [number, number, number, number];
  cols: number;
  rows: number;
  /** eastward component, m/s, row-major from the north-west */
  u: Float32Array;
  /** northward component, m/s */
  v: Float32Array;
  /** mean speed over all cells, m/s */
  meanSpeed: number;
}

const KMH_TO_MS = 1 / 3.6;

/** Inverse-distance-weighted interpolation of station winds onto a regular lon/lat grid. */
export function buildWindGrid(
  samples: readonly WindSample[],
  bounds: readonly [number, number, number, number],
  cols = 48,
  rows = 32,
  power = 2,
): WindGrid {
  const [w, s, e, n] = bounds;
  const u = new Float32Array(cols * rows);
  const v = new Float32Array(cols * rows);
  const su = samples.map(
    (x) => -Math.sin((x.directionDeg * Math.PI) / 180) * x.speedKmh * KMH_TO_MS,
  );
  const sv = samples.map(
    (x) => -Math.cos((x.directionDeg * Math.PI) / 180) * x.speedKmh * KMH_TO_MS,
  );
  let total = 0;
  for (let r = 0; r < rows; r++) {
    const lat = n - ((r + 0.5) / rows) * (n - s);
    const kx = Math.cos((lat * Math.PI) / 180);
    for (let c = 0; c < cols; c++) {
      const lon = w + ((c + 0.5) / cols) * (e - w);
      let wu = 0;
      let wv = 0;
      let wsum = 0;
      for (let i = 0; i < samples.length; i++) {
        const p = samples[i]!.lonLat;
        const dx = (p[0] - lon) * kx;
        const dy = p[1] - lat;
        const d2 = dx * dx + dy * dy + 1e-4;
        const wgt = 1 / Math.pow(d2, power / 2);
        wu += (su[i] ?? 0) * wgt;
        wv += (sv[i] ?? 0) * wgt;
        wsum += wgt;
      }
      const i = r * cols + c;
      u[i] = wsum ? wu / wsum : 0;
      v[i] = wsum ? wv / wsum : 0;
      total += Math.hypot(u[i]!, v[i]!);
    }
  }
  return { bounds, cols, rows, u, v, meanSpeed: total / (cols * rows) };
}

/** Bilinear sample of the grid at a lon/lat; returns [u, v] in m/s (zero outside the bounds). */
export function sampleWind(grid: WindGrid, lon: number, lat: number): [number, number] {
  const [w, s, e, n] = grid.bounds;
  const fx = ((lon - w) / (e - w)) * grid.cols - 0.5;
  const fy = ((n - lat) / (n - s)) * grid.rows - 0.5;
  if (fx < -0.5 || fy < -0.5 || fx > grid.cols - 0.5 || fy > grid.rows - 0.5) return [0, 0];
  const x0 = Math.max(0, Math.min(grid.cols - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(grid.rows - 1, Math.floor(fy)));
  const x1 = Math.min(grid.cols - 1, x0 + 1);
  const y1 = Math.min(grid.rows - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const at = (arr: Float32Array, x: number, y: number) => arr[y * grid.cols + x] ?? 0;
  const lerp2 = (arr: Float32Array) =>
    (at(arr, x0, y0) * (1 - tx) + at(arr, x1, y0) * tx) * (1 - ty) +
    (at(arr, x0, y1) * (1 - tx) + at(arr, x1, y1) * tx) * ty;
  return [lerp2(grid.u), lerp2(grid.v)];
}

/** Particle state: interleaved [lon, lat, ageSeconds] triples. */
export type Particles = Float32Array;

export function createParticles(
  count: number,
  bounds: readonly [number, number, number, number],
  seed: number | string,
  maxAgeSeconds = 12,
): Particles {
  const rng = seededRandom(seed);
  const p = new Float32Array(count * 3);
  const [w, s, e, n] = bounds;
  for (let i = 0; i < count; i++) {
    p[i * 3] = w + rng() * (e - w);
    p[i * 3 + 1] = s + rng() * (n - s);
    p[i * 3 + 2] = rng() * maxAgeSeconds; // staggered ages so respawns are spread out
  }
  return p;
}

export interface StepOptions {
  /** wall-clock seconds since the last step */
  dtSeconds: number;
  /** visual exaggeration: how many real seconds of drift one displayed second represents */
  timeScale?: number;
  maxAgeSeconds?: number;
  /** deterministic source for respawn positions */
  rng: () => number;
}

/**
 * Advects particles along the grid; respawns them at a random position when they age out or
 * leave the bounds. Mutates `particles` in place and returns it.
 */
export function stepParticles(particles: Particles, grid: WindGrid, opts: StepOptions): Particles {
  const { dtSeconds, timeScale = 900, maxAgeSeconds = 12, rng } = opts;
  const [w, s, e, n] = grid.bounds;
  const dt = dtSeconds * timeScale;
  for (let i = 0; i < particles.length; i += 3) {
    const lon = particles[i]!;
    const lat = particles[i + 1]!;
    const age = particles[i + 2]! + dtSeconds;
    const [u, v] = sampleWind(grid, lon, lat);
    const kx = 111_320 * Math.cos((lat * Math.PI) / 180);
    const nlon = lon + (u * dt) / kx;
    const nlat = lat + (v * dt) / 111_320;
    if (
      age > maxAgeSeconds ||
      nlon < w ||
      nlon > e ||
      nlat < s ||
      nlat > n ||
      (u === 0 && v === 0)
    ) {
      particles[i] = w + rng() * (e - w);
      particles[i + 1] = s + rng() * (n - s);
      particles[i + 2] = 0;
    } else {
      particles[i] = nlon;
      particles[i + 1] = nlat;
      particles[i + 2] = age;
    }
  }
  return particles;
}

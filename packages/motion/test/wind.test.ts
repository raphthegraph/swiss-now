import { describe, expect, it } from "vitest";
import { buildWindGrid, createParticles, sampleWind, stepParticles } from "../src/math/wind";
import { seededRandom } from "../src/math/random";

const bounds: [number, number, number, number] = [6, 46, 10, 48];

describe("wind grid", () => {
  it("turns a westerly (from 270°) into an eastward vector", () => {
    const grid = buildWindGrid(
      [{ lonLat: [8, 47], speedKmh: 36, directionDeg: 270 }],
      bounds,
      8,
      8,
    );
    const [u, v] = sampleWind(grid, 8, 47);
    expect(u).toBeCloseTo(10, 1); // 36 km/h = 10 m/s eastward
    expect(Math.abs(v)).toBeLessThan(1e-6);
    expect(grid.meanSpeed).toBeCloseTo(10, 1);
  });
  it("a northerly (from 0°) points south and blends between stations", () => {
    const grid = buildWindGrid(
      [
        { lonLat: [6.5, 47], speedKmh: 20, directionDeg: 0 },
        { lonLat: [9.5, 47], speedKmh: 20, directionDeg: 180 },
      ],
      bounds,
      16,
      8,
    );
    expect(sampleWind(grid, 6.5, 47)[1]).toBeLessThan(0);
    expect(sampleWind(grid, 9.5, 47)[1]).toBeGreaterThan(0);
    expect(Math.abs(sampleWind(grid, 8, 47)[1])).toBeLessThan(2);
  });
  it("is zero outside the bounds", () => {
    const grid = buildWindGrid(
      [{ lonLat: [8, 47], speedKmh: 36, directionDeg: 270 }],
      bounds,
      8,
      8,
    );
    expect(sampleWind(grid, 20, 47)).toEqual([0, 0]);
  });
});

describe("particles", () => {
  it("are deterministic for a seed and drift with the wind", () => {
    const grid = buildWindGrid(
      [{ lonLat: [8, 47], speedKmh: 36, directionDeg: 270 }],
      bounds,
      8,
      8,
    );
    const a = createParticles(50, bounds, "swiss");
    const b = createParticles(50, bounds, "swiss");
    expect(Array.from(a)).toEqual(Array.from(b));
    const before = a[0]!;
    stepParticles(a, grid, { dtSeconds: 1 / 60, rng: seededRandom(1), maxAgeSeconds: 1e9 });
    expect(a[0]!).toBeGreaterThan(before); // moved east
    expect(a[2]!).toBeGreaterThan(0);
  });
  it("respawns particles that leave the bounds or age out", () => {
    const grid = buildWindGrid(
      [{ lonLat: [8, 47], speedKmh: 200, directionDeg: 270 }],
      bounds,
      8,
      8,
    );
    const p = new Float32Array([9.99, 47, 0, 8, 47, 11.9]);
    stepParticles(p, grid, {
      dtSeconds: 1,
      timeScale: 3600,
      rng: seededRandom(7),
      maxAgeSeconds: 12,
    });
    expect(p[0]!).toBeLessThanOrEqual(10);
    expect(p[2]!).toBe(0); // respawned: age reset
    expect(p[5]!).toBe(0); // aged out: respawned too
  });
});

import { describe, expect, it } from "vitest";
import type { TripSnapshot } from "@swiss-now/core";
import {
  bearingDeg,
  cubicBezier,
  daylightStateAt,
  easeHouse,
  flowDashOffset,
  haversineMeters,
  measurePath,
  positionAlongPath,
  positionAlongTrip,
  pulseEnvelope,
  ringProgress,
  seededRandom,
  sunAltitudeDeg,
} from "../src/math/index";
import { interpolateCamera, SWITZERLAND_CAMERA, secondsToFrames } from "../src/specs/index";

describe("random", () => {
  it("is deterministic and uniform-ish", () => {
    const a = seededRandom("swiss-now");
    const b = seededRandom("swiss-now");
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
  });
});

describe("easing", () => {
  it("house curve starts at 0, ends at 1 and is fast-out", () => {
    expect(easeHouse(0)).toBe(0);
    expect(easeHouse(1)).toBe(1);
    expect(easeHouse(0.25)).toBeGreaterThan(0.6);
  });
  it("linear bezier is identity", () => {
    expect(cubicBezier([0, 0, 1, 1], 0.3)).toBeCloseTo(0.3, 4);
  });
});

describe("envelopes", () => {
  it("pulse decays over the period and loops", () => {
    expect(pulseEnvelope(0, 1000)).toBe(1);
    expect(pulseEnvelope(500, 1000)).toBeCloseTo(0.25, 6);
    expect(pulseEnvelope(1000, 1000)).toBe(1);
  });
  it("rings stagger and fade", () => {
    const r0 = ringProgress(0, 1000, 0, 2);
    const r1 = ringProgress(0, 1000, 1, 2);
    expect(r0.radius).toBe(0);
    expect(r1.radius).toBeCloseTo(0.5, 6);
    expect(r1.opacity).toBeLessThan(r0.opacity);
  });
  it("dash offset travels with speed and wraps", () => {
    expect(flowDashOffset(1000, 12, 24)).toBeCloseTo(-12, 6);
    expect(flowDashOffset(2000, 12, 24)).toBeCloseTo(-0, 6);
  });
});

describe("geo", () => {
  const bern: [number, number] = [7.4474, 46.948];
  const zurich: [number, number] = [8.5417, 47.3769];
  it("Bern–Zürich is about 95 km, bearing north-east", () => {
    const d = haversineMeters(bern, zurich);
    expect(d).toBeGreaterThan(93_000);
    expect(d).toBeLessThan(97_000);
    const b = bearingDeg(bern, zurich);
    expect(b).toBeGreaterThan(50);
    expect(b).toBeLessThan(70);
  });
  it("measures a path and positions along it", () => {
    const path = measurePath([bern, [8.0, 47.15], zurich]);
    expect(path.cumulative[0]).toBe(0);
    expect(path.lengthMeters).toBeGreaterThan(93_000);
    expect(positionAlongPath(path, 0).lonLat).toEqual(bern);
    expect(positionAlongPath(path, path.lengthMeters).lonLat).toEqual(zurich);
    const mid = positionAlongPath(path, path.lengthMeters / 2);
    expect(mid.progress).toBeCloseTo(0.5, 6);
    expect(mid.lonLat[0]).toBeGreaterThan(bern[0]);
    expect(mid.lonLat[0]).toBeLessThan(zurich[0]);
    // clamps
    expect(positionAlongPath(path, -1).progress).toBe(0);
    expect(positionAlongPath(path, 1e9).progress).toBe(1);
  });
});

describe("positionAlongTrip", () => {
  const path = measurePath([
    [7.4391, 46.9489], // Bern
    [7.62, 47.05], // Burgdorf-ish
    [7.907, 47.07], // Olten-ish
    [8.5417, 47.3769], // Zürich HB
  ]);
  const L = path.lengthMeters;
  const T0 = Date.parse("2026-09-07T10:00:00Z");
  const iso = (m: number) => new Date(T0 + m * 60_000).toISOString();
  const trip: TripSnapshot = {
    tripId: "t1",
    routeId: "IC1",
    routeShortName: "IC 1",
    pathId: "p",
    positionKind: "interpolated",
    cancelled: false,
    source: "otd-gtfs-rt",
    stops: [
      {
        stopId: "BN",
        distanceAlongPath: 0,
        scheduledArrival: iso(0),
        scheduledDeparture: iso(2),
        delaySeconds: 0,
        skipped: false,
      },
      {
        stopId: "OL",
        distanceAlongPath: L * 0.5,
        scheduledArrival: iso(30),
        scheduledDeparture: iso(32),
        delaySeconds: 0,
        skipped: false,
      },
      {
        stopId: "ZUE",
        distanceAlongPath: L,
        scheduledArrival: iso(60),
        scheduledDeparture: iso(62),
        delaySeconds: 300,
        skipped: false,
      },
    ],
  };

  it("is inactive at the origin before departure", () => {
    const p = positionAlongTrip(trip, path, T0 + 60_000);
    expect(p.active).toBe(false);
    expect(p.distanceMeters).toBe(0);
    expect(p.positionKind).toBe("interpolated");
  });
  it("is halfway between the first two stops mid-leg", () => {
    const p = positionAlongTrip(trip, path, T0 + 16 * 60_000);
    expect(p.active).toBe(true);
    expect(p.dwelling).toBe(false);
    expect(p.progress).toBeCloseTo(0.25, 2);
    expect(p.lastStopIndex).toBe(0);
  });
  it("dwells at an intermediate stop", () => {
    const p = positionAlongTrip(trip, path, T0 + 31 * 60_000);
    expect(p.dwelling).toBe(true);
    expect(p.progress).toBeCloseTo(0.5, 6);
  });
  it("a delay at the next stop slows the leg and interpolates the delay", () => {
    // leg OL→ZUE: dep 10:32, effective arrival 11:05 (60 + 5 min delay)
    const undelayedArrival = T0 + 60 * 60_000;
    const p = positionAlongTrip(trip, path, undelayedArrival);
    expect(p.active).toBe(true);
    expect(p.progress).toBeLessThan(1);
    expect(p.progress).toBeGreaterThan(0.9);
    expect(p.delaySeconds).toBeGreaterThan(200);
    expect(p.delaySeconds).toBeLessThanOrEqual(300);
    const arrived = positionAlongTrip(trip, path, T0 + 65 * 60_000 + 1);
    expect(arrived.active).toBe(false);
    expect(arrived.progress).toBe(1);
  });
  it("returns reported coordinates unchanged for reported positions", () => {
    const reported: TripSnapshot = {
      ...trip,
      positionKind: "reported",
      reportedLonLat: [8.0, 47.0],
    };
    const p = positionAlongTrip(reported, path, T0 + 16 * 60_000);
    expect(p.lonLat).toEqual([8.0, 47.0]);
    expect(p.positionKind).toBe("reported");
  });
});

describe("sun and daylight", () => {
  it("noon in Bern in September is day, midnight is night", () => {
    const noon = new Date("2026-09-07T11:00:00Z"); // ~13:00 CEST, near solar noon
    const midnight = new Date("2026-09-07T23:00:00Z");
    expect(sunAltitudeDeg(noon, 46.948, 7.4474)).toBeGreaterThan(40);
    expect(sunAltitudeDeg(midnight, 46.948, 7.4474)).toBeLessThan(-20);
    expect(daylightStateAt(noon)).toBe("day");
    expect(daylightStateAt(midnight)).toBe("night");
  });
  it("early evening in September is dusk", () => {
    // sunset in Bern on 7 Sept ≈ 19:55 CEST = 17:55 UTC
    expect(daylightStateAt(new Date("2026-09-07T18:05:00Z"))).toBe("dusk");
  });
});

describe("specs", () => {
  it("interpolates cameras along the shortest bearing arc", () => {
    const c = interpolateCamera(
      { ...SWITZERLAND_CAMERA, bearing: 350 },
      { ...SWITZERLAND_CAMERA, bearing: 10, zoom: 9.2 },
      0.5,
    );
    expect(c.bearing).toBeCloseTo(0, 6);
    expect(c.zoom).toBeCloseTo(8.2, 6);
  });
  it("converts seconds to frames at 30 fps", () => {
    expect(secondsToFrames(6)).toBe(180);
  });
});

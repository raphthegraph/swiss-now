import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  activeTrips,
  buildPatternPath,
  buildRailGraph,
  decodeTripUpdates,
  hhmmssToSeconds,
  nearestNode,
  patternIdFor,
  perStopDelays,
  serviceDayStart,
  serviceWindow,
  shortestPath,
  type RailDayFile,
  type RailPatternsFile,
} from "../src/data-sources/transit/index";

describe("gtfs static helpers", () => {
  it("parses times past midnight and builds stable pattern ids", () => {
    expect(hhmmssToSeconds("25:10:30")).toBe(25 * 3600 + 10 * 60 + 30);
    expect(patternIdFor("r", ["a", "b"])).toBe(patternIdFor("r", ["a", "b"]));
    expect(patternIdFor("r", ["a", "b"])).not.toBe(patternIdFor("r", ["b", "a"]));
  });
  it("service window is in Swiss local dates, yesterday through +days", () => {
    const w = serviceWindow(new Date("2026-09-08T22:30:00Z"), 2); // 00:30 CEST on the 9th
    expect(w).toEqual(["20260908", "20260909", "20260910", "20260911"]);
  });
  it("service day starts at local midnight (CEST in September, CET in January)", () => {
    expect(new Date(serviceDayStart("20260908")).toISOString()).toBe("2026-09-07T22:00:00.000Z");
    expect(new Date(serviceDayStart("20260115")).toISOString()).toBe("2026-01-14T23:00:00.000Z");
  });
});

describe("rail graph", () => {
  // two lines sharing a junction J: A–J and J–B, plus a detour line A–C–B that is longer
  const A: [number, number] = [7.0, 47.0];
  const J: [number, number] = [7.1, 47.0];
  const B: [number, number] = [7.2, 47.0];
  const C: [number, number] = [7.1, 47.1];
  const graph = buildRailGraph([
    [A, J],
    [J, B],
    [A, C, B],
  ]);
  it("merges shared vertices into one node", () => {
    expect(graph.nodes.length).toBe(4);
  });
  it("routes along the shortest line", () => {
    const p = shortestPath(graph, nearestNode(graph, A), nearestNode(graph, B))!;
    expect(p.map((i) => graph.nodes[i])).toEqual([A, J, B]);
  });
  it("builds a pattern path with stop distances and falls back to straight legs", () => {
    const far: [number, number] = [8.5, 47.5];
    const path = buildPatternPath(graph, "p1", [A, B, far]);
    expect(path.legKinds).toEqual(["network", "straight"]);
    expect(path.stopDistances[0]).toBe(0);
    expect(path.stopDistances[1]).toBeGreaterThan(15_000);
    expect(path.stopDistances[2]).toBeGreaterThan(path.stopDistances[1]!);
    expect(path.coordinates[1]).toEqual(J); // went through the junction, not the detour
  });
});

describe("gtfs-rt", () => {
  const bytes = new Uint8Array(
    readFileSync(new URL("./fixtures/tripupdates-sample.pb", import.meta.url)),
  );
  it("decodes trip updates with absolute stop times", () => {
    const feed = decodeTripUpdates(bytes);
    expect(feed.updates.size).toBe(150);
    expect(feed.timestamp).toMatch(/^2026-09-08T/);
    const first = [...feed.updates.values()][0]!;
    expect(first.startDate).toMatch(/^\d{8}$/);
    expect(first.stops.length).toBeGreaterThan(1);
    expect(first.stops.some((s) => s.arrival !== undefined || s.departure !== undefined)).toBe(
      true,
    );
  });
  it("derives per-stop delays and propagates the last known delay", () => {
    const dayStart = serviceDayStart("20260908");
    const times: [number, number][] = [
      [8 * 3600, 8 * 3600],
      [8 * 3600 + 600, 8 * 3600 + 660],
      [8 * 3600 + 1200, 8 * 3600 + 1200],
    ];
    const update = {
      tripId: "t",
      cancelled: false,
      added: false,
      stops: [{ stopId: "s2", departure: dayStart / 1000 + 8 * 3600 + 660 + 240, skipped: false }],
    };
    expect(perStopDelays(times, ["s1", "s2", "s3"], update, dayStart)).toEqual([0, 240, 240]);
    // delay-only updates (the common case for scheduled trips) and unset zero times
    const delayOnly = {
      tripId: "t",
      cancelled: false,
      added: false,
      stops: [
        { stopId: "s2", departureDelay: 120, skipped: false },
        { stopId: "s3", arrivalDelay: 60, skipped: false },
      ],
    };
    expect(perStopDelays(times, ["s1", "s2", "s3"], delayOnly, dayStart)).toEqual([0, 120, 60]);
  });
  it("treats zero stop times as unset", () => {
    const feed = decodeTripUpdates(bytes);
    let zeroTimes = 0;
    for (const u of feed.updates.values())
      for (const s of u.stops) if (s.arrival === 0 || s.departure === 0) zeroTimes++;
    expect(zeroTimes).toBe(0);
  });
  it("selects active trips around now and attaches delays", () => {
    const dayStart = serviceDayStart("20260908");
    const day: RailDayFile = {
      schemaVersion: 1,
      serviceDate: "20260908",
      feedVersion: "x",
      trips: [
        [
          "running",
          "pat",
          "IC 1",
          "Zürich HB",
          [
            [8 * 3600, 8 * 3600],
            [9 * 3600, 9 * 3600],
          ],
        ],
        [
          "later",
          "pat",
          "IC 1",
          "Zürich HB",
          [
            [12 * 3600, 12 * 3600],
            [13 * 3600, 13 * 3600],
          ],
        ],
        [
          "earlier",
          "pat",
          "IC 1",
          "Zürich HB",
          [
            [5 * 3600, 5 * 3600],
            [6 * 3600, 6 * 3600],
          ],
        ],
      ],
    };
    const patterns: RailPatternsFile = { pat: ["r", ["s1", "s2"]] };
    const feed = {
      timestamp: "",
      updates: new Map([
        [
          "running",
          {
            tripId: "running",
            cancelled: false,
            added: false,
            stops: [{ stopId: "s2", arrival: dayStart / 1000 + 9 * 3600 + 300, skipped: false }],
          },
        ],
      ]),
    };
    const active = activeTrips(day, patterns, feed, {
      now: new Date(dayStart + 8.5 * 3600 * 1000),
    });
    expect(active.map((t) => t.tripId)).toEqual(["running"]);
    expect(active[0]!.positionKind).toBe("interpolated");
    expect(active[0]!.stops[1]!.delaySeconds).toBe(300);
  });
  it("trims passed stops to the last one and drops trips outside the keep set", () => {
    const dayStart = serviceDayStart("20260908");
    const day: RailDayFile = {
      schemaVersion: 1,
      serviceDate: "20260908",
      feedVersion: "x",
      trips: [
        [
          "t",
          "pat",
          "IC",
          "X",
          [
            [8 * 3600, 8 * 3600],
            [8 * 3600 + 600, 8 * 3600 + 660],
            [9 * 3600, 9 * 3600],
          ],
        ],
        [
          "abroad",
          "far",
          "TGV",
          "Paris",
          [
            [8 * 3600, 8 * 3600],
            [9 * 3600, 9 * 3600],
          ],
        ],
      ],
    };
    const patterns: RailPatternsFile = {
      pat: ["r", ["s1", "s2", "s3"]],
      far: ["r2", ["f1", "f2"]],
    };
    const now = new Date(dayStart + (8 * 3600 + 1800) * 1000); // between s2 and s3
    const active = activeTrips(day, patterns, undefined, {
      now,
      keepIfAnyStop: new Set(["s1", "s2", "s3"]),
    });
    expect(active.map((t) => t.tripId)).toEqual(["t"]);
    expect(active[0]!.stops.map((s) => s.stopId)).toEqual(["s2", "s3"]);
    // a train dwelling at its terminus keeps its last two stops
    const atEnd = activeTrips(day, patterns, undefined, {
      now: new Date(dayStart + (9 * 3600 + 30) * 1000),
      keepIfAnyStop: new Set(["s1", "s2", "s3"]),
    });
    expect(atEnd[0]!.stops.length).toBeGreaterThanOrEqual(2);
    expect(active[0]!.stops[0]!.distanceAlongPath).toBe(1000); // original index preserved in the placeholder
  });
});

describe("rail state", () => {
  it("computes the on-time index from current delays", async () => {
    const { buildRailState, serviceDayStart } = await import("../src/data-sources/transit/index");
    const dayStart = serviceDayStart("20260908");
    const day: RailDayFile = {
      schemaVersion: 1,
      serviceDate: "20260908",
      feedVersion: "x",
      trips: [
        [
          "a",
          "pat",
          "IC",
          "X",
          [
            [8 * 3600, 8 * 3600],
            [9 * 3600, 9 * 3600],
          ],
        ],
        [
          "b",
          "pat",
          "IC",
          "X",
          [
            [8 * 3600, 8 * 3600],
            [9 * 3600, 9 * 3600],
          ],
        ],
      ],
    };
    const patterns: RailPatternsFile = { pat: ["r", ["s1", "s2"]] };
    const feed = {
      timestamp: new Date(dayStart + 8.5 * 3600 * 1000).toISOString(),
      updates: new Map([
        [
          "b",
          {
            tripId: "b",
            cancelled: false,
            added: false,
            stops: [{ stopId: "s1", departure: dayStart / 1000 + 8 * 3600 + 600, skipped: false }],
          },
        ],
      ]),
    };
    const state = buildRailState({
      day,
      patterns,
      feed,
      pathsUrl: "/rail/paths",
      gtfsBuild: "x",
      now: new Date(dayStart + 8.5 * 3600 * 1000),
    });
    expect(state.activeTrips.length).toBe(2);
    expect(state.onTimeIndex).toBe(0.5);
    expect(state.freshness).toBe("live");
  });
});

describe("simplifyPath", () => {
  it("drops collinear vertices but keeps stops and endpoints", async () => {
    const { simplifyPath } = await import("../src/data-sources/transit/index");
    const line: [number, number][] = [];
    for (let i = 0; i <= 100; i++) line.push([7 + i * 0.001, 47 + (i === 50 ? 0.0005 : 0)]);
    const out = simplifyPath(line, 20, [25]);
    expect(out.length).toBeLessThan(10);
    expect(out[0]).toEqual(line[0]);
    expect(out[out.length - 1]).toEqual(line[100]);
    expect(out).toContainEqual(line[25]); // a stop
    expect(out).toContainEqual(line[50]); // the 55 m kink survives a 20 m tolerance
  });
});

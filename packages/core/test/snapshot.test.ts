import { describe, expect, it } from "vitest";
import { buildSnapshot, parseSnapshotId, snapshotId, snapshotSlot } from "../src/snapshot/index";

describe("snapshots", () => {
  it("floors to 10-minute slots and round-trips ids", () => {
    const d = new Date("2026-09-08T13:07:42Z");
    expect(snapshotSlot(d).toISOString()).toBe("2026-09-08T13:00:00.000Z");
    expect(snapshotId(snapshotSlot(d))).toBe("20260908T1300");
    expect(parseSnapshotId("20260908T1300")?.toISOString()).toBe("2026-09-08T13:00:00.000Z");
    expect(parseSnapshotId("nope")).toBeUndefined();
  });
  it("keeps only the newest radar frame", () => {
    const now = new Date("2026-09-08T13:07:42Z");
    const snap = buildSnapshot({
      now,
      weather: {
        schemaVersion: 1,
        updatedAt: now.toISOString(),
        observedAt: now.toISOString(),
        freshness: "live",
        sources: ["meteoswiss-radar"],
        stations: [],
        observations: [],
        extremes: {},
        fields: [
          {
            id: "a",
            kind: "radar-rain-rate",
            bounds: [2, 43, 12, 49],
            width: 1,
            height: 1,
            imageUrl: "https://x/a",
            scaleId: "rainRate",
            validAt: "2026-09-08T13:05:00Z",
            source: "meteoswiss-radar",
          },
          {
            id: "b",
            kind: "radar-rain-rate",
            bounds: [2, 43, 12, 49],
            width: 1,
            height: 1,
            imageUrl: "https://x/b",
            scaleId: "rainRate",
            validAt: "2026-09-08T13:00:00Z",
            source: "meteoswiss-radar",
          },
        ],
      },
    });
    expect(snap.at).toBe("2026-09-08T13:00:00.000Z");
    expect(snap.weather?.fields.map((f) => f.id)).toEqual(["a"]);
  });
});

import { describe, expect, it } from "vitest";
import { buildSnapshot, parseSnapshotId, snapshotId, snapshotSlot } from "../src/snapshot/index";
import { FL } from "../src/i18n";

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

describe("snapshot figures", () => {
  it("derives rail figures from the stored summary", async () => {
    const { figuresForSnapshot } = await import("../src/topics/snapshot-figures");
    const snap = {
      schemaVersion: 1 as const,
      at: "2026-09-08T12:00:00.000Z",
      generatedAt: "2026-09-08T12:00:30.000Z",
      rail: {
        observedAt: "2026-09-08T12:00:00Z",
        freshness: "live" as const,
        running: 900,
        cancelled: 3,
        onTimeIndex: 0.93,
        worst: [{ line: "IC1", headsign: "Genève", delaySeconds: 1200 }],
        disruptions: [],
      },
      energy: {
        observedAt: "2026-09-08T11:40:00Z",
        freshness: "live" as const,
        borderFlows: { DE: 400 },
        netImportMW: -120,
        priceEurPerMWh: 150,
      },
    };
    const rail = figuresForSnapshot("rail", snap, Date.parse("2026-09-08T12:05:00Z"));
    expect(rail.map((f) => f.id)).toEqual(["running", "on-time", "largest-delay"]);
    expect(rail[2]!.value).toBe(20);
    const energy = figuresForSnapshot("energy", snap, 0);
    expect(energy[0]).toMatchObject({ id: "net-flow", label: FL.netExport, value: 120 });
  });
});

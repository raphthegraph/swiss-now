import { describe, expect, it } from "vitest";
import {
  HISTORY_SLOTS,
  buildSnapshot,
  parseSnapshotId,
  rollHistory,
  snapshotId,
  snapshotSlot,
} from "../src/snapshot/index";
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

describe("snapshot history", () => {
  const obs = (id: string, v: number) =>
    ({
      stationId: id,
      parameter: "airTemperature",
      value: v,
      observedAt: "2026-09-09T10:00:00Z",
      source: "meteoswiss-smn",
    }) as never;
  const weather = (pairs: [string, number][]) =>
    ({ observations: pairs.map(([id, v]) => obs(id, v)) }) as never;
  it("rolls a 24-hour window and pads stations that appear later", () => {
    let h = rollHistory(undefined, "20260909T1000", weather([["a", 10]]));
    expect(h.slots).toEqual(["20260909T1000"]);
    expect(h.temperature["a"]).toEqual([10]);
    h = rollHistory(
      h,
      "20260909T1010",
      weather([
        ["a", 11],
        ["b", 5],
      ]),
    );
    expect(h.temperature["a"]).toEqual([10, 11]);
    expect(h.temperature["b"]).toEqual([null, 5]);
    // the same slot written twice replaces the last value
    h = rollHistory(h, "20260909T1010", weather([["a", 12]]));
    expect(h.slots).toEqual(["20260909T1000", "20260909T1010"]);
    expect(h.temperature["a"]).toEqual([10, 12]);
    expect(h.temperature["b"]).toBeUndefined();
  });
  it("never exceeds the window", () => {
    let h: ReturnType<typeof rollHistory> | undefined;
    for (let k = 0; k < HISTORY_SLOTS + 5; k++)
      h = rollHistory(h, `slot${String(k).padStart(4, "0")}`, weather([["a", k]]));
    expect(h!.slots.length).toBe(HISTORY_SLOTS);
    expect(h!.temperature["a"]!.length).toBe(HISTORY_SLOTS);
    expect(h!.temperature["a"]![HISTORY_SLOTS - 1]).toBe(HISTORY_SLOTS + 4);
  });
});

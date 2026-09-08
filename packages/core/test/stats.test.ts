import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeGeo, parseSdmxCsv } from "../src/data-sources/bfs-sdmx/index";
import { parseHesta, parseStatent } from "../src/data-sources/bfs-pxweb/indicators";
import { parseKofCsv } from "../src/data-sources/kof/index";
import { pivot } from "../src/data-sources/stats/index";
import { IndicatorSeries, latestValues } from "../src/state/stats";

const fx = (f: string) => readFileSync(join(__dirname, "fixtures/stats", f), "utf8");

describe("SDMX", () => {
  it("reads population rows and normalizes geo keys", () => {
    const rows = parseSdmxCsv(fx("statpop-sample.csv"), "GEO");
    expect(rows.find((r) => r.geo === "261")).toMatchObject({ period: "2025", value: 440935 });
    expect(normalizeGeo("8100")).toBe("CH");
    expect(normalizeGeo("B_102")).toBeUndefined();
    expect(normalizeGeo("0261")).toBe("261");
    const t = pivot(rows);
    expect(t.periods).toEqual(["2025"]);
    expect(t.values["261"]).toEqual([440935]);
    expect(t.values["CH"]?.[0]).toBeGreaterThan(8_000_000);
  });
  it("keeps only the percentage rows of the vacancy flow", () => {
    const rows = parseSdmxCsv(
      fx("lwz-sample.csv"),
      "GR_KT_GDE",
      (r) => r["MEASURE_DIMENSION"] === "PC",
    );
    expect(rows.every((r) => r.value < 100)).toBe(true);
    const zh = rows.find((r) => r.geo === "261");
    expect(zh?.period).toBe("2025");
  });
});

describe("PxWeb indicators", () => {
  it("reads STATENT full-time equivalents per municipality", () => {
    const t = parseStatent(JSON.parse(fx("statent-sample.json")));
    expect(t.periods).toEqual(["2024"]);
    expect(t.values["CH"]).toEqual([4404860]);
    expect(t.values["261"]?.[0]).toBeGreaterThan(300_000);
  });
  it("reads HESTA hotel nights per canton and month, dropping empty future months", () => {
    const t = parseHesta(JSON.parse(fx("hesta-sample.json")));
    expect(t.periods[0]).toBe("2025-01");
    expect(t.periods.length).toBeGreaterThan(12);
    expect(t.periods.length).toBeLessThan(24);
    expect(t.values["CH"]?.[0]).toBe(3198449);
    expect(t.values["ZH"]?.[0]).toBe(447065);
    expect(Object.keys(t.values)).toContain("GR");
  });
  it("reads the KOF barometer", () => {
    const k = parseKofCsv(fx("kof-sample.csv"));
    expect(k.periods[k.periods.length - 1]).toBe("2026-08");
    expect(k.values[k.values.length - 1]).toBeCloseTo(106.72);
  });
});

describe("indicator series", () => {
  it("validates and reports the latest values", () => {
    const s = IndicatorSeries.parse({
      schemaVersion: 1,
      meta: {
        id: "x",
        topic: "population",
        label: { de: "x" },
        unit: "",
        decimals: 0,
        geoLevel: "municipality",
        periodKind: "year",
        source: "bfs-sdmx",
        cube: "c",
        attribution: "BFS",
        publishedAt: "2026-09-08T00:00:00Z",
      },
      periods: ["2024", "2025"],
      values: { "1": [10, null], "2": [5, 7] },
    });
    expect(latestValues(s)).toEqual({ period: "2025", values: { "1": 10, "2": 7 } });
    expect(s.meta.scale).toBe("sequential");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  joinWastaNames,
  parsePlantsCsv,
  plantType,
  simplifyGrid,
  toWgs84,
} from "../src/data-sources/bfe-plants/index";
import { parseReservoirCsv } from "../src/data-sources/sfoe-reservoirs/index";
import { PowerPlant, ReservoirState } from "../src/state/energy-sites";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", "energy-sites", name), "utf8");

describe("electricity production plants", () => {
  it("projects LV95 to WGS84", () => {
    // the LV95 origin (old Bern observatory) lies at 7.43863° E / 46.95108° N in WGS84
    const [lon, lat] = toWgs84(2600000, 1200000);
    expect(lon).toBeCloseTo(7.4386, 3);
    expect(lat).toBeCloseTo(46.9511, 3);
  });
  it("folds the register's categories into plant types", () => {
    expect(plantType("subcat_1", "plantcat_7")).toBe("hydro-storage");
    expect(plantType("subcat_1", "plantcat_6")).toBe("hydro-pumped");
    expect(plantType("subcat_1", "plantcat_4")).toBe("hydro-run");
    expect(plantType("subcat_6", "")).toBe("nuclear");
    expect(plantType("subcat_10", "plantcat_12")).toBe("waste");
    expect(plantType("subcat_8", "")).toBe("gas");
  });
  it("keeps plants of 1 MW and more with coordinates, largest first, and names hydro plants from WASTA", () => {
    const plants = parsePlantsCsv(fx("plants.csv"), 1000);
    expect(plants.length).toBeGreaterThan(3);
    for (const p of plants) {
      expect(PowerPlant.parse(p)).toBeTruthy();
      expect(p.kw).toBeGreaterThanOrEqual(1000);
      expect(p.lonLat[0]).toBeGreaterThan(5.9);
      expect(p.lonLat[1]).toBeGreaterThan(45.8);
    }
    expect(plants[0]!.kw).toBeGreaterThanOrEqual(plants[plants.length - 1]!.kw);
    const named = joinWastaNames(plants, fx("wasta.csv"));
    expect(named).toBeGreaterThan(0);
    expect(plants.some((p) => /Innertkirchen|Leibstadt/i.test(p.name))).toBe(true);
  });
  it("keeps the 220/380 kV lines in operation and rounds their coordinates", () => {
    const grid = simplifyGrid(JSON.parse(fx("grid-sample.json")));
    expect(grid.features.length).toBe(4);
    for (const f of grid.features) {
      expect(f.properties.kv).toBeGreaterThanOrEqual(220);
      const first = (
        f.geometry.type === "LineString" ? f.geometry.coordinates[0] : f.geometry.coordinates[0]![0]
      )!;
      expect(String(first[0]).split(".")[1]!.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("storage lakes", () => {
  it("reads the latest week per region and a weekly series", () => {
    const r = parseReservoirCsv(fx("reservoirs.csv"), 52);
    expect(r).toBeTruthy();
    expect(ReservoirState.parse(r)).toBeTruthy();
    expect(r!.regions.total!.maxGwh).toBeGreaterThan(8000);
    expect(r!.regions.wallis!.gwh).toBeLessThanOrEqual(r!.regions.wallis!.maxGwh);
    expect(r!.series.length).toBe(52);
    expect(r!.series[r!.series.length - 1]!.date).toBe(r!.date);
  });
});

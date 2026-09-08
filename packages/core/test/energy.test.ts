import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseFrequency,
  parseImportExport,
  zurichToIso,
} from "../src/data-sources/swissgrid/index";
import {
  latestGeneration,
  parsePriceCurrent,
  parsePublicPower,
  publicPowerUrl,
} from "../src/data-sources/energy-charts/index";
import { buildEnergyState } from "../src/data-sources/energy/index";
import { EnergyState } from "../src/state/layers";

const fx = (f: string) => JSON.parse(readFileSync(join(__dirname, "fixtures/energy", f), "utf8"));

describe("swissgrid", () => {
  it("reads border flows with import/export sign from the arrow direction", () => {
    const f = parseImportExport(fx("swissgrid-importexport.json"));
    expect(f.flows).toEqual({ DE: 409, AT: 509, IT: -2464, FR: 1538 });
    expect(f.netImportMW).toBe(-8); // balance sheet export 8 MW
    expect(f.observedAt).toBe("2026-09-08T14:42:32.000Z"); // 16:42:32 CEST
  });
  it("converts Zurich wall clock in winter and summer", () => {
    expect(zurichToIso("15.01.2026 12:00:00")).toBe("2026-01-15T11:00:00.000Z");
    expect(zurichToIso("15.07.2026 12:00:00")).toBe("2026-07-15T10:00:00.000Z");
  });
  it("reads the frequency series", () => {
    const f = parseFrequency(fx("swissgrid-frequency.json"))!;
    expect(f.hz).toBeGreaterThan(49.5);
    expect(f.hz).toBeLessThan(50.5);
    expect(f.series.length).toBeGreaterThan(10);
    expect(f.gridTimeDeviationS).toBeCloseTo(-0.104);
  });
});

describe("energy-charts", () => {
  it("maps production types and finds the latest hour with data", () => {
    const s = parsePublicPower(fx("energy-charts-public-power.json"));
    expect(s.unixSeconds).toHaveLength(37);
    expect(s.byTypeMW.nuclear?.length).toBe(37);
    const latest = latestGeneration(s)!;
    expect(latest.byTypeMW.nuclear).toBeCloseTo(2851.3);
    expect(latest.byTypeMW.runOfRiver).toBeCloseTo(868);
    expect(latest.renewableSharePct).toBeCloseTo(30.3);
    expect(latest.observedAt).toBe(new Date(1788868800 * 1000).toISOString());
  });
  it("reads the current day-ahead price", () => {
    expect(parsePriceCurrent(fx("energy-charts-price-current.json"))).toEqual({
      eurPerMWh: 156.99,
      hour: "2026-09-08T15:00:00.000Z",
      validUntil: "2026-09-08T16:00:00.000Z",
    });
    expect(publicPowerUrl(new Date("2026-09-08T12:00:00Z"), 24)).toContain(
      "start=2026-09-07T12:00&end=2026-09-08T12:00",
    );
  });
});

describe("energy state", () => {
  it("assembles a valid state and grades freshness", () => {
    const now = new Date("2026-09-08T15:05:00Z");
    const s = buildEnergyState(
      {
        flows: parseImportExport(fx("swissgrid-importexport.json")),
        frequency: parseFrequency(fx("swissgrid-frequency.json")),
        generation: parsePublicPower(fx("energy-charts-public-power.json")),
        price: parsePriceCurrent(fx("energy-charts-price-current.json")),
      },
      now,
    );
    expect(EnergyState.parse(s)).toBeTruthy();
    expect(s.netImportMW).toBe(-8);
    expect(s.generation?.byTypeMW.nuclear).toBeCloseTo(2851.3);
    expect(s.price?.eurPerMWh).toBe(156.99);
    expect(["live", "aging"]).toContain(s.freshness);
  });
});

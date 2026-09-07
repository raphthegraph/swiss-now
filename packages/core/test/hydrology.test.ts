import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildHydrologyState,
  fetchHydroRows,
  normalizeHydroRows,
  parseHydroResults,
  parseWktPoint,
} from "../src/data-sources/hydrology/index";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/lindas-hydro.json", import.meta.url), "utf8"),
) as unknown;

describe("LINDAS hydrology", () => {
  it("parses WKT points as [lon, lat]", () => {
    expect(parseWktPoint("POINT(8.092031848446195 46.74573701982401)")).toEqual([
      8.092031848446195, 46.74573701982401,
    ]);
    expect(parseWktPoint("LINESTRING(1 2, 3 4)")).toBeUndefined();
  });

  it("normalizes rows into WGS84 stations, m³/s discharge and optional danger levels", () => {
    const n = normalizeHydroRows(parseHydroResults(fixture));
    const basel = n.stations.find((s) => s.id === "bafu:2289");
    expect(basel?.kind).toBe("hydro-river");
    expect(basel?.waterBody).toBe("Rhein");
    expect(basel?.lonLat[0]).toBeCloseTo(7.6, 0);
    const q = n.observations.find(
      (o) => o.stationId === "bafu:2289" && o.parameter === "discharge",
    );
    expect(q?.value).toBeGreaterThan(100); // m³/s, not L/s
    expect(q?.value).toBeLessThan(5000);
    // +01:00 offset parsed as an instant → UTC string
    expect(q?.observedAt).toMatch(/Z$/);
    expect(new Date(q!.observedAt).getUTCHours()).toBe((23 - 1 + 24) % 24);
    expect(n.stations.some((s) => s.kind === "hydro-lake")).toBe(true);
    // undefined danger rows carry no entry; defined ones are 1–5
    for (const v of Object.values(n.dangerLevels)) expect(v).toBeGreaterThanOrEqual(1);
    expect(Object.keys(n.dangerLevels).length).toBeLessThan(n.stations.length);
  });

  it("builds a HydrologyState with freshness from the 10-minute cadence", () => {
    const n = normalizeHydroRows(parseHydroResults(fixture));
    const state = buildHydrologyState(n, new Date(new Date(n.observedAt!).getTime() + 25 * 60_000));
    expect(state.freshness).toBe("live"); // 21-min typical lag is subtracted
    expect(state.sources).toEqual(["bafu-lindas-hydro"]);
    expect(state.warnings).toEqual([]);
  });

  it("POSTs the SPARQL query with the right headers through an injected fetch", async () => {
    let seen: RequestInit | undefined;
    const fake: typeof fetch = async (_u, init) => {
      seen = init;
      return new Response(JSON.stringify(fixture), { status: 200 });
    };
    const rows = await fetchHydroRows({ fetch: fake });
    expect(rows.length).toBeGreaterThan(3);
    expect(seen?.method).toBe("POST");
    expect(String(seen?.body)).toContain("query=");
    expect((seen?.headers as Record<string, string>)["Accept"]).toContain("sparql-results+json");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildWeatherState,
  fetchGeoAdminLayer,
  geoAdminLayerUrl,
  normalizeGeoAdminLayer,
  parseGeoAdminLayer,
} from "../src/data-sources/geoadmin/index";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8")) as unknown;

const TEMP = "ch.meteoschweiz.messwerte-lufttemperatur-10min";
const RAIN = "ch.meteoschweiz.messwerte-niederschlag-10min";
const GUST = "ch.meteoschweiz.messwerte-wind-boeenspitze-kmh-10min";

describe("geo.admin measurement layers", () => {
  it("parses the provider GeoJSON including the '-' missing-timestamp marker", () => {
    const fc = parseGeoAdminLayer(fixture(RAIN));
    expect(fc.crs?.properties.name).toBe("EPSG:2056");
    expect(fc.features.some((f) => f.properties.reference_ts === "-")).toBe(true);
  });

  it("normalizes into WGS84 stations inside Switzerland and skips missing values", () => {
    const rain = normalizeGeoAdminLayer(parseGeoAdminLayer(fixture(RAIN)), RAIN);
    expect(rain.stations.length).toBeGreaterThan(rain.observations.length);
    for (const s of rain.stations) {
      expect(s.id.startsWith("smn:")).toBe(true);
      expect(s.lonLat[0]).toBeGreaterThan(5.9);
      expect(s.lonLat[0]).toBeLessThan(10.6);
      expect(s.lonLat[1]).toBeGreaterThan(45.7);
      expect(s.lonLat[1]).toBeLessThan(47.9);
    }
    const arosa = rain.stations.find((s) => s.id === "smn:ARO");
    expect(arosa?.elevation).toBe(1880);
    expect(arosa?.lonLat[0]).toBeCloseTo(9.68, 1);
    expect(arosa?.lonLat[1]).toBeCloseTo(46.79, 1);
  });

  it("emits gusts without duplicating wind direction (direction comes from the wind-speed layer)", () => {
    const gust = normalizeGeoAdminLayer(parseGeoAdminLayer(fixture(GUST)), GUST);
    const params = new Set(gust.observations.map((o) => o.parameter));
    expect(params.has("windGust")).toBe(true);
    expect(params.has("windDirection")).toBe(false);
  });

  it("builds a WeatherState with extremes, merged stations and freshness", () => {
    const layers = [TEMP, RAIN, GUST].map((id) =>
      normalizeGeoAdminLayer(parseGeoAdminLayer(fixture(id)), id as typeof TEMP),
    );
    const now = new Date(new Date(layers[0]!.observedAt!).getTime() + 8 * 60_000);
    const state = buildWeatherState(layers, now);
    expect(state.freshness).toBe("live");
    expect(state.stations.length).toBeLessThanOrEqual(
      layers.reduce((n, l) => n + l.stations.length, 0),
    );
    expect(state.extremes.warmest).toBeDefined();
    expect(state.extremes.coldest).toBeDefined();
    expect(state.extremes.warmest!.value).toBeGreaterThanOrEqual(state.extremes.coldest!.value);
    expect(state.rainingShare).toBeGreaterThanOrEqual(0);
    expect(state.sources).toEqual(["geoadmin-messwerte"]);
  });

  it("builds URLs and sends a User-Agent through an injected fetch", async () => {
    expect(geoAdminLayerUrl(TEMP, "de")).toBe(`https://data.geo.admin.ch/${TEMP}/${TEMP}_de.json`);
    let seenUa: string | undefined;
    const fakeFetch: typeof fetch = async (_url, init) => {
      seenUa = (init?.headers as Record<string, string>)["User-Agent"];
      return new Response(JSON.stringify(fixture(TEMP)), { status: 200 });
    };
    const fc = await fetchGeoAdminLayer(TEMP, { fetch: fakeFetch });
    expect(fc.features.length).toBe(6);
    expect(seenUa).toContain("SwissNow");
  });

  it("throws an UpstreamError on non-2xx", async () => {
    const failing: typeof fetch = async () => new Response("nope", { status: 503 });
    await expect(fetchGeoAdminLayer(TEMP, { fetch: failing })).rejects.toThrow(/503/);
  });
});

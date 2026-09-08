import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseUgzTail, ugzTime } from "../src/data-sources/ugz-air/index";
import { parseSensorCommunity } from "../src/data-sources/sensor-community/index";
import { parsePollenLayer } from "../src/data-sources/meteoswiss/pollen/index";
import { airIndexFor, buildAirState } from "../src/data-sources/air/index";
import { parseBulletin, parseImis } from "../src/data-sources/slf/index";
import { parseFireDanger } from "../src/data-sources/bafu-fire/index";
import { hailInSeason, parseHailAssetId } from "../src/data-sources/meteoswiss/hail/index";
import { buildHazardsState } from "../src/data-sources/hazards/index";
import { AirState } from "../src/state/layers";
import { HazardsState } from "../src/state/hazards";

const fx = (dir: string, f: string) => readFileSync(join(__dirname, "fixtures", dir, f), "utf8");

describe("air", () => {
  it("reads the tail of the Zürich hourly file", () => {
    expect(ugzTime("2026-09-08T14:00+0100")).toBe("2026-09-08T13:00:00.000Z");
    const r = parseUgzTail(fx("air", "ugz-tail.csv"));
    expect(r.stations.length).toBeGreaterThan(0);
    const o3 = r.observations.find(
      (o) => o.stationId === "ugz:Zch_Stampfenbachstrasse" && o.parameter === "o3",
    );
    expect(o3?.value).toBeCloseTo(114.45);
    expect(o3?.observedAt).toBe("2026-09-08T13:00:00.000Z");
    expect(r.stations[0]!.tier).toBe("reference");
  });
  it("reads Sensor.Community particulate sensors as the citizen tier", () => {
    const r = parseSensorCommunity(JSON.parse(fx("air", "sensor-community-sample.json")));
    expect(r.stations.length).toBeGreaterThan(20);
    expect(r.stations.every((s) => s.tier === "citizen" && s.kind === "air")).toBe(true);
    expect(r.observations.some((o) => o.parameter === "pm25")).toBe(true);
  });
  it("reads a pollen layer (EPSG:2056 → WGS84)", () => {
    const r = parsePollenLayer(JSON.parse(fx("air", "pollen-graeser.json")), "pollenGrasses");
    expect(r.stations).toHaveLength(15);
    const locarno = r.stations.find((s) => s.name.de.startsWith("Locarno"))!;
    expect(locarno.lonLat[0]).toBeCloseTo(8.79, 1);
    expect(r.observations.find((o) => o.stationId === locarno.id)?.value).toBe(20);
  });
  it("grades the short-term index and builds a valid state", () => {
    expect(airIndexFor("o3", 50)).toBe(1);
    expect(airIndexFor("o3", 130)).toBe(3);
    expect(airIndexFor("no2", 200)).toBe(6);
    expect(airIndexFor("windGust", 80)).toBeUndefined();
    const now = new Date("2026-09-08T15:30:00Z");
    const state = buildAirState(
      {
        reference: parseUgzTail(fx("air", "ugz-tail.csv")),
        citizen: parseSensorCommunity(JSON.parse(fx("air", "sensor-community-sample.json"))),
        pollen: parsePollenLayer(JSON.parse(fx("air", "pollen-graeser.json")), "pollenGrasses"),
      },
      now,
    );
    expect(AirState.parse(state)).toBeTruthy();
    expect(state.indexByStation["ugz:Zch_Stampfenbachstrasse"]).toBe(2); // O₃ 114 µg/m³
    expect(state.worstIndex).toBeGreaterThanOrEqual(2);
    expect(state.pollen.stations).toHaveLength(15);
  });
});

describe("hazards", () => {
  it("reads the forest-fire regions and reprojects the polygons", () => {
    const r = parseFireDanger(JSON.parse(fx("hazards", "fire-danger-sample.json")));
    expect(r.regions).toHaveLength(4);
    expect(r.regions[0]).toMatchObject({
      canton: "BE",
      level: 3,
      name: { de: "Aaretal (BE)", en: "Aaretal (BE)" },
    });
    const gj = r.geojson as { features: { geometry: { coordinates: number[][][][] } }[] };
    const [lon, lat] = gj.features[0]!.geometry.coordinates[0]![0]![0]!;
    expect(lon).toBeGreaterThan(7);
    expect(lon).toBeLessThan(8);
    expect(lat).toBeGreaterThan(46.5);
  });
  it("reads IMIS stations and the latest measurement per station", () => {
    const r = parseImis(
      JSON.parse(fx("hazards", "imis-stations-sample.json")),
      JSON.parse(fx("hazards", "imis-measurements-sample.json")),
    );
    expect(r.stations.length).toBeGreaterThan(0);
    expect(r.stations[0]!.kind).toBe("snow");
    expect(r.observations.some((o) => o.parameter === "airTemperature")).toBe(true);
  });
  it("handles the empty summer bulletin and parses winter regions", () => {
    expect(parseBulletin({ type: "FeatureCollection", features: [] })).toEqual([]);
    const winter = parseBulletin({
      features: [
        {
          id: "CH-1111",
          properties: {
            region_name: "Jungfrau",
            danger_level: "3",
            valid_until: "2026-01-15T17:00:00+01:00",
          },
        },
      ],
    });
    expect(winter[0]).toMatchObject({
      id: "CH-1111",
      level: 3,
      validUntil: "2026-01-15T16:00:00.000Z",
    });
  });
  it("parses hail asset ids and the season", () => {
    expect(parseHailAssetId("mzc262511605vl.850.h5")?.validAt).toBe("2026-09-08T16:05:00.000Z");
    expect(parseHailAssetId("bzc262511605vl.845.h5")).toBeUndefined();
    expect(hailInSeason(new Date("2026-09-08T00:00:00Z"))).toBe(true);
    expect(hailInSeason(new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
  it("assembles a valid hazards state", () => {
    const now = new Date("2026-09-08T16:30:00Z");
    const fire = parseFireDanger(JSON.parse(fx("hazards", "fire-danger-sample.json")));
    const s = buildHazardsState(
      {
        fire: { regions: fire.regions, issuedAt: fire.issuedAt },
        avalanche: { regions: [] },
        snow: parseImis(
          JSON.parse(fx("hazards", "imis-stations-sample.json")),
          JSON.parse(fx("hazards", "imis-measurements-sample.json")),
        ),
        geojsonUrls: {
          fire: "/api/hazards/regions/fire",
          avalanche: "/api/hazards/regions/avalanche",
        },
      },
      now,
    );
    expect(HazardsState.parse(s)).toBeTruthy();
    expect(s.avalanche.inSeason).toBe(false);
    expect(s.hailInSeason).toBe(true);
    expect(s.fireDanger.regions.map((r) => r.level)).toContain(3);
  });
});

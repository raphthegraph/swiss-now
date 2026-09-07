import { describe, expect, it } from "vitest";
import {
  Event,
  HydrologyState,
  Observation,
  Station,
  StorySpec,
  SwissNowState,
  TripSnapshot,
  WeatherState,
} from "../src/state/index.js";
import { SOURCES, SourceId, listSources } from "../src/sources/index.js";

const t = "2026-09-07T19:00:00Z";

const bern: Station = {
  id: "smn:BER",
  name: { de: "Bern / Zollikofen", en: "Bern / Zollikofen" },
  kind: "weather",
  lonLat: [7.4639, 46.9908],
  elevation: 553,
  cantonCode: "BE",
  source: "meteoswiss-smn",
};

const temp: Observation = {
  stationId: "smn:BER",
  parameter: "airTemperature",
  value: 16.1,
  observedAt: t,
};

describe("entity schemas", () => {
  it("accept a valid station and observation", () => {
    expect(Station.parse(bern)).toEqual(bern);
    expect(Observation.parse(temp)).toEqual(temp);
  });

  it("reject LV95 coordinates masquerading as lon/lat", () => {
    const bad = { ...bern, lonLat: [2600000, 1200000] };
    expect(Station.safeParse(bad).success).toBe(false);
  });

  it("reject timestamps without an offset", () => {
    expect(Observation.safeParse({ ...temp, observedAt: "2026-09-07 19:00" }).success).toBe(false);
  });

  it("require positionKind on trips and default cancelled to false", () => {
    const trip = TripSnapshot.parse({
      tripId: "trip-1",
      routeId: "IC1",
      routeShortName: "IC 1",
      pathId: "path:IC1:a",
      positionKind: "interpolated",
      stops: [
        {
          stopId: "didok:8507000",
          distanceAlongPath: 0,
          scheduledArrival: t,
          scheduledDeparture: t,
        },
        {
          stopId: "didok:8503000",
          distanceAlongPath: 95_000,
          scheduledArrival: "2026-09-07T19:56:00Z",
          scheduledDeparture: "2026-09-07T19:58:00Z",
          delaySeconds: 180,
        },
      ],
      source: "otd-gtfs-rt",
    });
    expect(trip.cancelled).toBe(false);
    expect(trip.stops[0]?.delaySeconds).toBe(0);
    expect(TripSnapshot.safeParse({ ...trip, positionKind: undefined }).success).toBe(false);
  });

  it("accept an earthquake event", () => {
    const quake = Event.parse({
      id: "sed:2026rqydud",
      kind: "earthquake",
      severity: 1,
      geometry: { type: "Point", coordinates: [7.0419, 45.9201] },
      startsAt: "2026-09-06T11:21:25Z",
      headline: {
        de: "Erdbeben bei Bourg-Saint-Pierre VS",
        en: "Earthquake near Bourg-Saint-Pierre VS",
      },
      magnitude: 1.5,
      depthKm: 7.4,
      reviewed: true,
      source: "sed-fdsn",
    });
    expect(quake.magnitude).toBe(1.5);
  });
});

describe("layer and composite schemas", () => {
  const weather = WeatherState.parse({
    schemaVersion: 1,
    updatedAt: t,
    observedAt: t,
    freshness: "live",
    sources: ["meteoswiss-smn"],
    stations: [bern],
    observations: [temp],
    extremes: { warmest: { stationId: "smn:BER", value: 16.1, observedAt: t } },
  });

  const hydrology = HydrologyState.parse({
    schemaVersion: 1,
    updatedAt: t,
    observedAt: t,
    freshness: "aging",
    sources: ["bafu-lindas-hydro"],
    stations: [],
    observations: [],
    dangerLevels: { "bafu:2019": 1 },
  });

  it("defaults optional arrays", () => {
    expect(weather.fields).toEqual([]);
    expect(hydrology.warnings).toEqual([]);
  });

  it("assemble a SwissNowState with only the MVP layers", () => {
    const state = SwissNowState.parse({
      schemaVersion: 1,
      generatedAt: t,
      freshness: { weather: "live", hydrology: "aging" },
      weather,
      hydrology,
      summary: { generatedAt: t, national: [] },
      meta: { sources: [SOURCES["meteoswiss-smn"], SOURCES["bafu-lindas-hydro"]] },
    });
    expect(state.rail).toBeUndefined();
    expect(state.summary.byCanton).toEqual({});
  });

  it("validates a minimal StorySpec", () => {
    const story = StorySpec.parse({
      schemaVersion: 1,
      date: "2026-09-07",
      generatedAt: t,
      title: { de: "Die Schweiz heute", en: "Switzerland today" },
      chapters: [
        {
          id: "c1",
          type: "weather-summary",
          layer: "weather",
          headline: { de: "Ein milder Spätsommertag" },
          data: {},
          camera: { center: [8.2, 46.8], zoom: 7 },
          durationHint: 6,
          score: 0.8,
        },
      ],
      credits: ["Source: MeteoSwiss", "© swisstopo"],
    });
    expect(story.chapters[0]?.camera.pitch).toBe(0);
  });
});

describe("source registry", () => {
  it("has an entry for every SourceId with a valid attribution and cadence", () => {
    for (const id of SourceId.options) {
      const meta = SOURCES[id];
      expect(meta.id).toBe(id);
      expect(meta.attribution.length).toBeGreaterThan(3);
      expect(meta.cadenceSeconds).toBeGreaterThan(0);
    }
    expect(listSources().length).toBe(SourceId.options.length);
  });

  it("flags sources that are not cleared for commercial use", () => {
    expect(SOURCES["sed-fdsn"].commercialUse).toBe("unresolved");
    expect(SOURCES["fedro-datex2"].commercialUse).toBe("ask");
    expect(SOURCES["meteoswiss-smn"].commercialUse).toBe("yes");
  });
});

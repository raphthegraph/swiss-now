import { describe, expect, it } from "vitest";
import { buildStory } from "../src/story/index";
import type { Snapshot } from "../src/snapshot/index";

const t = "2026-09-08T12:00:00Z";
const snap: Snapshot = {
  schemaVersion: 1,
  at: "2026-09-08T12:00:00.000Z",
  generatedAt: t,
  weather: {
    schemaVersion: 1,
    updatedAt: t,
    observedAt: t,
    freshness: "live",
    sources: ["meteoswiss-smn"],
    stations: [
      {
        id: "smn:CHU",
        name: { de: "Chur", en: "Chur" },
        kind: "weather",
        lonLat: [9.53, 46.87],
        source: "meteoswiss-smn",
      },
      {
        id: "smn:JUN",
        name: { de: "Jungfraujoch", en: "Jungfraujoch" },
        kind: "weather",
        lonLat: [7.98, 46.55],
        source: "meteoswiss-smn",
      },
    ],
    observations: [],
    fields: [],
    extremes: {
      warmest: { stationId: "smn:CHU", value: 31.5, observedAt: t },
      coldest: { stationId: "smn:JUN", value: 4.3, observedAt: t },
      wettest24h: { stationId: "smn:JUN", value: 12, observedAt: t },
      windiestGust: { stationId: "smn:JUN", value: 88, observedAt: t },
    },
    rainingAreaShare: 0.12,
  },
  rail: {
    observedAt: t,
    freshness: "live",
    running: 990,
    cancelled: 2,
    onTimeIndex: 0.91,
    worst: [{ line: "IC1", headsign: "Genève", delaySeconds: 2100 }],
    disruptions: [],
  },
  seismic: {
    schemaVersion: 1,
    updatedAt: t,
    observedAt: t,
    freshness: "live",
    sources: ["sed-fdsn"],
    windowDays: 30,
    events: [
      {
        id: "sed:1",
        kind: "earthquake",
        severity: 2,
        geometry: { type: "Point", coordinates: [9.6, 46.6] },
        startsAt: "2026-09-08T03:00:00Z",
        headline: { de: "Erdbeben M2.5 bei Savognin GR", en: "M2.5 earthquake near Savognin GR" },
        magnitude: 2.5,
        source: "sed-fdsn",
      },
    ],
  },
};

describe("story builder", () => {
  it("leads with the weather summary and ranks the rest by score", () => {
    const story = buildStory([snap], { date: "2026-09-08", now: new Date(t) });
    expect(story.chapters[0]!.type).toBe("weather-summary");
    expect(story.chapters[0]!.headline.en).toContain("31.5° in Chur");
    const types = story.chapters.map((c) => c.type);
    expect(types).toContain("extremes");
    expect(types).toContain("rail");
    expect(types).toContain("quake");
    expect(types).toContain("rainfall");
    expect(story.chapters.length).toBeLessThanOrEqual(6);
    for (let i = 2; i < story.chapters.length; i++)
      expect(story.chapters[i - 1]!.score).toBeGreaterThanOrEqual(story.chapters[i]!.score);
    expect(story.credits).toContain("Source: MeteoSwiss");
    expect(story.credits).toContain("© swisstopo");
  });
  it("produces a placeholder when there is nothing to tell", () => {
    const story = buildStory([], { date: "2026-09-08", now: new Date(t) });
    expect(story.chapters).toHaveLength(1);
    expect(story.chapters[0]!.id).toBe("empty");
  });
});

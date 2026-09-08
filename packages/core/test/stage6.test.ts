import { describe, expect, it } from "vitest";
import { buildStory, chapterFigures } from "../src/story/index";
import { buildAviationState, parseAdsb } from "../src/data-sources/adsb-fi/index";
import { AviationState } from "../src/state/aviation";
import { policyFromEnv, sourceAccess } from "../src/sources/policy";
import { StorySpec } from "../src/state/story";

const t = "2026-09-08T12:00:00Z";
const base = { schemaVersion: 1 as const, at: "2026-09-08T12:00:00.000Z", generatedAt: t };

describe("story candidates from the expansion", () => {
  it("adds events, hazard, air and vote chapters when they are notable", () => {
    const story = buildStory(
      [
        {
          ...base,
          events: {
            observedAt: t,
            freshness: "live",
            count: 42,
            placed: 30,
            byCategory: { accident: 20, fire: 5, news: 17 },
          },
          hazards: {
            observedAt: t,
            freshness: "live",
            fireMaxLevel: 5,
            fireRegionsAt3Plus: 132,
            hail: true,
          },
          air: {
            observedAt: t,
            freshness: "live",
            worstIndex: 4,
            referenceStations: 4,
            citizenSensors: 110,
          },
        },
      ],
      {
        date: "2026-09-08",
        now: new Date(t),
        politics: {
          schemaVersion: 1,
          updatedAt: t,
          observedAt: t,
          freshness: "live",
          sources: ["bfs-pxweb"],
          latestDate: "2026-09-06",
          latest: [
            {
              schemaVersion: 1,
              meta: {
                id: "6900",
                date: "2026-09-06",
                title: { de: "Testvorlage", en: "Test proposal" },
                national: { yesPct: 55.2, turnoutPct: 48, accepted: true },
              },
              status: "final",
              national: { yesPct: 55.2, turnoutPct: 48 },
              byCanton: {},
              byMunicipality: {
                "1": { yesPct: 60, turnoutPct: 50 },
                "2": { yesPct: 40, turnoutPct: 45 },
              },
              geoVintage: 2026,
              source: "bfs-pxweb",
              updatedAt: t,
            },
          ],
          index: [],
          upcoming: [],
        },
      },
    );
    expect(StorySpec.parse(story)).toBeTruthy();
    const types = story.chapters.map((c) => c.type);
    expect(types).toEqual(expect.arrayContaining(["vote", "hazard", "events", "air"]));
    const vote = story.chapters.find((c) => c.type === "vote")!;
    expect(vote.headline.en).toContain("Accepted: Test proposal");
    expect((vote.data as { byMunicipality: Record<string, number> }).byMunicipality["1"]).toBe(60);
    expect(chapterFigures(vote)[0]).toEqual({ label: "Yes", value: 55.2, decimals: 1, unit: "%" });
    expect(story.credits).toContain("Source: swissvotes.ch");
  });
});

describe("aviation", () => {
  it("parses readsb aircraft and builds a valid gated state", () => {
    const json = {
      now: 1788890000,
      ac: [
        {
          hex: "4B1A2C",
          flight: "SWR123  ",
          r: "HB-JCA",
          t: "BCS3",
          lat: 47.2,
          lon: 8.1,
          alt_baro: 25000,
          gs: 430,
          track: 92.5,
          baro_rate: -640,
          seen_pos: 1.2,
        },
        { hex: "4B0000", lat: 46.9, lon: 7.4, alt_baro: "ground", seen_pos: 3 },
        { hex: "AAAAAA", lat: 46.5, lon: 8.0, seen_pos: 400 }, // stale
        { hex: "BBBBBB" }, // no position
      ],
    };
    const ac = parseAdsb(json);
    expect(ac).toHaveLength(2);
    expect(ac[0]).toMatchObject({
      icao24: "4b1a2c",
      callsign: "SWR123",
      registration: "HB-JCA",
      altitudeM: 7620,
      trackDeg: 92.5,
      groundSpeedKt: 430,
      onGround: false,
      positionKind: "reported",
    });
    expect(ac[1]!.onGround).toBe(true);
    const s = buildAviationState(ac, new Date(1788890000 * 1000 + 3000));
    expect(AviationState.parse(s)).toBeTruthy();
    expect(s.freshness).toBe("live");
  });
  it("stays blocked by the policy unless explicitly allowed for local runs", () => {
    expect(sourceAccess("adsb-fi")).toBe("blocked");
    expect(sourceAccess("adsb-fi", policyFromEnv({ SWISS_NOW_ALLOW: "adsb-fi" }))).toBe("notice");
    expect(policyFromEnv({ SWISS_NOW_ALLOW: "nope,adsb-fi" }).allow).toEqual(["adsb-fi"]);
  });
});

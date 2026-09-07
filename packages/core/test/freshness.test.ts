import { describe, expect, it } from "vitest";
import {
  computeFreshness,
  freshnessForSource,
  ttlForCadence,
  worstFreshness,
} from "../src/freshness/index";

const now = new Date("2026-09-07T20:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

describe("computeFreshness", () => {
  it("is live within 1.5× cadence", () => {
    expect(computeFreshness(minutesAgo(12), 600, 0, now)).toBe("live");
  });
  it("subtracts the typical publication lag", () => {
    // 10-min feed, 9-min lag, observed 20 min ago → effective age 11 min → live
    expect(computeFreshness(minutesAgo(20), 600, 540, now)).toBe("live");
  });
  it("ages, goes stale, then outage", () => {
    expect(computeFreshness(minutesAgo(25), 600, 0, now)).toBe("aging");
    expect(computeFreshness(minutesAgo(90), 600, 0, now)).toBe("stale");
    expect(computeFreshness(minutesAgo(200), 600, 0, now)).toBe("outage");
  });
  it("treats missing or invalid timestamps as outage", () => {
    expect(computeFreshness(undefined, 600, 0, now)).toBe("outage");
    expect(computeFreshness("not a date", 600, 0, now)).toBe("outage");
  });
  it("never goes negative when observations are in the future (clock skew)", () => {
    expect(computeFreshness(minutesAgo(-5), 600, 0, now)).toBe("live");
  });
});

describe("freshnessForSource", () => {
  it("uses cadence and lag from the registry", () => {
    // MeteoSwiss SMN: 10-min cadence, ~9-min lag
    expect(freshnessForSource("meteoswiss-smn", minutesAgo(20), now)).toBe("live");
    expect(freshnessForSource("meteoswiss-smn", minutesAgo(70), now)).toBe("stale");
  });
});

describe("worstFreshness / ttlForCadence", () => {
  it("returns the weakest input", () => {
    expect(worstFreshness(["live", "aging", "live"])).toBe("aging");
    expect(worstFreshness([])).toBe("live");
  });
  it("bounds TTLs between 60 s and 1 h", () => {
    expect(ttlForCadence(30)).toBe(60);
    expect(ttlForCadence(600)).toBe(600);
    expect(ttlForCadence(86_400)).toBe(3600);
  });
});

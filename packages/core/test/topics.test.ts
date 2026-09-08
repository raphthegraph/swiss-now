import { describe, expect, it } from "vitest";
import { SOURCES, accessForSources, sourceAccess } from "../src/sources/index";
import {
  DEFAULT_VIEW,
  TOPICS,
  TOPIC_GROUPS,
  TOPIC_ORDER,
  parseViewState,
  serializeViewState,
  switchTopic,
  topicsInGroup,
} from "../src/topics/index";

describe("topic registry", () => {
  it("declares every topic with known sources, a group and map first", () => {
    for (const id of TOPIC_ORDER) {
      const s = TOPICS[id];
      expect(s.id).toBe(id);
      expect(TOPIC_GROUPS.map((g) => g.id)).toContain(s.group);
      for (const src of s.sources) expect(SOURCES[src]).toBeDefined();
      if (s.modes.includes("map")) expect(s.modes[0]).toBe("map");
      expect(s.label.en).toBeTruthy();
    }
    expect(topicsInGroup("live").map((s) => s.id)).toEqual([
      "weather",
      "water",
      "air",
      "hazards",
      "events",
    ]);
  });
  it("keeps the built topics commercially clean or noticed, never blocked", () => {
    for (const id of TOPIC_ORDER) {
      const s = TOPICS[id];
      if (s.built) expect(accessForSources(s.sources)).not.toBe("blocked");
    }
    expect(sourceAccess("adsb-fi")).toBe("blocked");
    expect(sourceAccess("sed-fdsn")).toBe("notice");
    expect(sourceAccess("sed-fdsn", { strict: true })).toBe("blocked");
    expect(sourceAccess("meteoswiss-smn")).toBe("allowed");
  });
});

describe("view state", () => {
  it("round-trips through the URL and omits defaults", () => {
    expect(parseViewState({})).toEqual(DEFAULT_VIEW);
    expect(serializeViewState(DEFAULT_VIEW)).toBe("");
    const v = parseViewState(
      new URLSearchParams("topic=weather&mode=timeline&t=20260908T1200&place=ZH"),
    );
    expect(v).toEqual({ topic: "weather", mode: "timeline", t: "20260908T1200", place: "ZH" });
    expect(serializeViewState(v)).toBe("topic=weather&mode=timeline&t=20260908T1200&place=ZH");
  });
  it("falls back for unknown topics, unbuilt topics and unsupported modes", () => {
    expect(parseViewState({ topic: "nope" }).topic).toBe("now");
    expect(parseViewState({ topic: "aviation" }).topic).toBe("now");
    expect(parseViewState({ topic: "rail", mode: "compare" }).mode).toBe("map");
    expect(parseViewState({ topic: "now", mode: "charts" }).mode).toBe("map");
    expect(parseViewState({ t: "<script>" }).t).toBeUndefined();
  });
  it("keeps the mode across topics when supported", () => {
    const v = { topic: "weather", mode: "timeline", t: "x" } as const;
    expect(switchTopic(v, "water")).toEqual({ topic: "water", mode: "map" });
    expect(switchTopic({ topic: "now", mode: "map" }, "rail")).toEqual({
      topic: "rail",
      mode: "map",
    });
  });
});

describe("presence", () => {
  it("renders the selected topic in full and NOW contributors quietly", async () => {
    const { presenceFor, layersNeeded } = await import("../src/topics/index");
    expect(presenceFor("rail", "rail")).toBe("full");
    expect(presenceFor("rail", "weather")).toBe("off");
    expect(presenceFor("now", "rail")).toBe("quiet");
    expect(presenceFor("now", "seismic")).toBe("quiet");
    expect(presenceFor("now", "politics")).toBe("off");
    expect(presenceFor("now", "politics", { voteSunday: true })).toBe("quiet");
    expect(presenceFor("politics", "politics")).toBe("full");
    expect(layersNeeded("water")).toEqual(["hydrology"]);
    expect(layersNeeded("now")).toEqual(
      expect.arrayContaining(["weather", "hydrology", "rail", "seismic"]),
    );
  });
});

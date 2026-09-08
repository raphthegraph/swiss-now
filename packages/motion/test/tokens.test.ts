import { describe, expect, it } from "vitest";
import {
  cssVariablesBlock,
  daylightState,
  layerAccent,
  scaleStops,
  toCssVariables,
} from "../src/tokens/index";

describe("tokens", () => {
  it("exports CSS custom properties for every accent and duration", () => {
    const vars = toCssVariables();
    expect(vars["--sn-accent-rail-delay"]).toBe(layerAccent.railDelay);
    expect(vars["--sn-duration-layer-switch"]).toBe("480ms");
    expect(vars["--sn-ease-house"]).toContain("cubic-bezier");
    expect(cssVariablesBlock()).toMatch(/^:root \{\n/);
  });

  it("keeps scale stops sorted by domain", () => {
    for (const stops of Object.values(scaleStops)) {
      for (let i = 1; i < stops.length; i++) {
        expect(stops[i]![0]).toBeGreaterThan(stops[i - 1]![0]);
      }
    }
  });

  it("maps sun altitude to daylight states", () => {
    expect(daylightState(-10, true)).toBe("night");
    expect(daylightState(0, true)).toBe("dawn");
    expect(daylightState(0, false)).toBe("dusk");
    expect(daylightState(30, false)).toBe("day");
  });
});

describe("topic accents", () => {
  it("has an accent colour for every topic in the registry", async () => {
    const { TOPICS, TOPIC_ORDER } = await import("@swiss-now/core/topics");
    for (const id of TOPIC_ORDER)
      expect(layerAccent[TOPICS[id].accent as keyof typeof layerAccent]).toMatch(/^#/);
  });
});

describe("formatNumber", () => {
  it("formats deterministically in the Swiss convention", async () => {
    const { formatNumber } = await import("../src/format");
    expect(formatNumber(1101)).toBe("1’101");
    expect(formatNumber(1234567.891, 1)).toBe("1’234’567.9");
    expect(formatNumber(-4.25, 2)).toBe("−4.25");
    expect(formatNumber(0.5, 0)).toBe("1");
    expect(formatNumber(NaN)).toBe("–");
  });
});

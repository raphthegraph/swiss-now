import { describe, expect, it } from "vitest";
import {
  dangerLevelColor,
  delayToPulseRadius,
  dischargeToFlowSpeed,
  legendTicks,
  magnitudeToRings,
  rainRateColor,
  temperatureColor,
  windParticleDensity,
} from "../src/scales/index.js";
import { scaleStops } from "../src/tokens/color.js";

const hexToRgb = (c: string) => {
  const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(c);
  if (!m) throw new Error(`unexpected colour format ${c}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])] as const;
};

describe("colour scales", () => {
  it("clamp to the domain", () => {
    expect(temperatureColor(-100)).toBe(temperatureColor(-20));
    expect(temperatureColor(100)).toBe(temperatureColor(40));
  });
  it("get warmer with temperature (red channel rises from 10 °C to 30 °C)", () => {
    const [r10] = hexToRgb(temperatureColor(10));
    const [r30] = hexToRgb(temperatureColor(30));
    const [, , b0] = hexToRgb(temperatureColor(0));
    const [, , b30] = hexToRgb(temperatureColor(30));
    expect(r30).toBeGreaterThan(r10);
    expect(b0).toBeGreaterThan(b30);
  });
  it("rain is transparent below the first stop", () => {
    expect(rainRateColor(0)).toMatch(/rgba\(.*, 0\)$/);
  });
  it("danger level 5 is darker than level 1", () => {
    const [r1, g1, b1] = hexToRgb(dangerLevelColor(1));
    const [r5, g5, b5] = hexToRgb(dangerLevelColor(5));
    expect(r5 + g5 + b5).toBeLessThan(r1 + g1 + b1);
  });
  it("legend ticks mirror the token stops", () => {
    expect(legendTicks("dangerLevel").map((t) => t.value)).toEqual(
      scaleStops.dangerLevel.map((s) => s[0]),
    );
  });
});

describe("numeric scales", () => {
  it("wind density is 0 in calm air and 1 in a storm", () => {
    expect(windParticleDensity(1)).toBe(0);
    expect(windParticleDensity(80)).toBe(1);
    expect(windParticleDensity(31.5)).toBeCloseTo(0.5, 2);
  });
  it("flow speed is 1 at normal discharge and capped in floods", () => {
    expect(dischargeToFlowSpeed(1)).toBe(1);
    expect(dischargeToFlowSpeed(10)).toBe(3);
    expect(dischargeToFlowSpeed(0.1)).toBe(0.35);
  });
  it("pulse radius grows with the square root of the delay", () => {
    expect(delayToPulseRadius(60)).toBe(4);
    expect(delayToPulseRadius(1800)).toBe(28);
    expect(delayToPulseRadius(600)).toBeGreaterThan(delayToPulseRadius(300));
  });
  it("magnitude → rings", () => {
    expect(magnitudeToRings(1.5)).toEqual({ rings: 2, radiusKm: 4 * Math.pow(2, 0.5) });
    expect(magnitudeToRings(6).rings).toBe(5);
    expect(magnitudeToRings(-2).rings).toBe(1);
  });
});

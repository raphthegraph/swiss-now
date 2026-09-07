import { describe, expect, it } from "vitest";
import { looksLikeLv95, lv95ToWgs84, wgs84ToLv95 } from "../src/geo/proj";

describe("LV95 ↔ WGS84", () => {
  it("maps the LV95 origin (Bern old observatory) to ~7.4386 E, 46.9511 N", () => {
    const [lon, lat] = lv95ToWgs84([2_600_000, 1_200_000]);
    expect(lon).toBeCloseTo(7.4386, 3);
    expect(lat).toBeCloseTo(46.9511, 3);
  });
  it("round-trips Zürich HB within centimetres", () => {
    const zh: [number, number] = [8.5402, 47.3782];
    const [e, n] = wgs84ToLv95(zh);
    expect(e).toBeGreaterThan(2_682_000);
    expect(e).toBeLessThan(2_684_000);
    const back = lv95ToWgs84([e, n]);
    expect(back[0]).toBeCloseTo(zh[0], 5);
    expect(back[1]).toBeCloseTo(zh[1], 5);
  });
  it("recognises LV95 magnitudes", () => {
    expect(looksLikeLv95([2_771_032.3, 1_184_823])).toBe(true);
    expect(looksLikeLv95([8.5, 47.4])).toBe(false);
  });
});

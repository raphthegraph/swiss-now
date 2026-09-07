import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodeOdimComposite,
  parseRadarAssetId,
  radarAssetHref,
  rainingShareOfSwitzerland,
  RADAR_OUTPUT,
  stacDayId,
  warpToMercatorPng,
  listRadarFrames,
} from "../src/data-sources/meteoswiss/radar/index";
import { lv95ToWgs84 } from "../src/geo/proj";

const sample = new Uint8Array(readFileSync(new URL("./fixtures/rzc-sample.h5", import.meta.url)));

describe("radar asset ids", () => {
  it("parses product and valid time from the filename", () => {
    expect(parseRadarAssetId("rzc262502210vl.001.h5")).toEqual({
      product: "RZC",
      validAt: "2026-09-07T22:10:00.000Z",
    });
    expect(parseRadarAssetId("cpc2625022050_00060.001.h5")).toEqual({
      product: "CPC",
      validAt: "2026-09-07T22:05:00.000Z",
    });
    expect(parseRadarAssetId("tzc262502210vl.801.h5")).toBeUndefined();
    expect(parseRadarAssetId("../etc/passwd")).toBeUndefined();
  });
  it("builds safe hrefs and day ids", () => {
    expect(stacDayId(new Date("2026-09-08T00:30:00Z"))).toBe("20260908-ch");
    expect(radarAssetHref("rzc262502210vl.001.h5", "20260907-ch")).toMatch(
      /^https:\/\/data\.geo\.admin\.ch\//,
    );
    expect(radarAssetHref("rzc262502210vl.001.h5/../x", "20260907-ch")).toBeUndefined();
  });
});

describe("ODIM decoding", () => {
  it("decodes the live RZC sample into a 710×640 mm/h grid on the fixed LV95 origin", async () => {
    const grid = await decodeOdimComposite(sample);
    expect(grid.width).toBe(710);
    expect(grid.height).toBe(640);
    expect(grid.unit).toBe("mm/h");
    expect(grid.originEast).toBe(2_255_000);
    expect(grid.originNorth).toBe(1_480_000);
    expect(grid.endTime).toBe("2026-09-07T22:10:00Z");
    let finite = 0;
    for (const v of grid.values) if (!Number.isNaN(v)) finite++;
    expect(finite).toBeGreaterThan(grid.values.length * 0.5);
    // the grid's north-west corner maps to the documented UL corner (~2.69 E, 49.37 N)
    const [lon, lat] = lv95ToWgs84([grid.originEast, grid.originNorth]);
    expect(lon).toBeCloseTo(2.689, 1);
    expect(lat).toBeCloseTo(49.374, 1);
  });

  it("warps to a Mercator PNG with transparent dry pixels and a shared ramp", async () => {
    const grid = await decodeOdimComposite(sample);
    const ramp = (v: number): readonly [number, number, number, number] => [
      62,
      109,
      156,
      v > 1 ? 255 : 160,
    ];
    const img = warpToMercatorPng(grid, ramp);
    expect(img.width).toBe(RADAR_OUTPUT.width);
    expect(img.bounds).toEqual(RADAR_OUTPUT.bounds);
    expect(img.png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(img.png.length).toBeLessThan(400_000);
    const share = rainingShareOfSwitzerland(grid);
    expect(share).toBeGreaterThanOrEqual(0);
    expect(share).toBeLessThanOrEqual(1);
  });
});

describe("STAC listing", () => {
  it("lists frames newest-first from an injected fetch and tolerates the empty tomorrow item", async () => {
    const fake: typeof fetch = async (url) => {
      const u = String(url);
      if (u.endsWith("/20260908-ch"))
        return new Response(
          JSON.stringify({
            id: "20260908-ch",
            assets: {
              "rzc262510005vl.001.h5": {
                href: "https://data.geo.admin.ch/x/rzc262510005vl.001.h5",
              },
              "rzc262510000vl.001.h5": {
                href: "https://data.geo.admin.ch/x/rzc262510000vl.001.h5",
              },
              "cpc2625100000_00060.001.h5": { href: "https://data.geo.admin.ch/x/cpc.h5" },
            },
          }),
        );
      if (u.endsWith("/20260907-ch"))
        return new Response(
          JSON.stringify({
            id: "20260907-ch",
            assets: { "rzc262502355vl.001.h5": { href: "https://data.geo.admin.ch/x/y.h5" } },
          }),
        );
      return new Response("", { status: 404 });
    };
    const frames = await listRadarFrames({
      fetch: fake,
      now: new Date("2026-09-08T00:10:00Z"),
      limit: 10,
    });
    expect(frames.map((f) => f.validAt)).toEqual([
      "2026-09-08T00:05:00.000Z",
      "2026-09-08T00:00:00.000Z",
      "2026-09-07T23:55:00.000Z",
    ]);
    expect(frames.every((f) => f.product === "RZC")).toBe(true);
  });
});

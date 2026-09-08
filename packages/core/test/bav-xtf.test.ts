import { describe, expect, it } from "vitest";
import { parseSegmentXml } from "../src/data-sources/transit/bav-xtf";

describe("BAV XTF segments", () => {
  it("parses a Netzsegment polyline from LV95 into WGS84", () => {
    const xml = `<Schienennetz_LV95_V1_3.Schienennetz.Netzsegment TID="x">
      <Infrastrukturbetreiber>BLS</Infrastrukturbetreiber><Spurweite>Normalspur</Spurweite>
      <Geometrie><POLYLINE>
        <COORD><C1>2600000.000</C1><C2>1200000.000</C2></COORD>
        <COORD><C1>2601000.000</C1><C2>1200500.000</C2></COORD>
      </POLYLINE></Geometrie>
    </Schienennetz_LV95_V1_3.Schienennetz.Netzsegment>`;
    const seg = parseSegmentXml(xml)!;
    expect(seg.operator).toBe("BLS");
    expect(seg.coordinates.length).toBe(2);
    expect(seg.coordinates[0]![0]).toBeCloseTo(7.4386, 3);
    expect(seg.coordinates[0]![1]).toBeCloseTo(46.9511, 3);
    expect(parseSegmentXml("<x/>")).toBeUndefined();
  });
});

/**
 * BAV "Schienennetz" (Swiss railway network) from the INTERLIS 2.3 transfer file on
 * data.geo.admin.ch (`schienennetz_2056_de.xtf`, ≈ 31 MB, 3 424 `Netzsegment` polylines in LV95,
 * 464 k coordinates; dataset dated 2021-07). Parsed with a streaming regex scan — no GDAL needed.
 * Covers all railways incl. BLS, SOB, RhB, MGB etc., unlike the SBB-only line dataset.
 */
import { createReadStream } from "node:fs";
import type { LonLat } from "../../state/common";
import { lv95ToWgs84 } from "../../geo/proj";

export const BAV_XTF_URL =
  "https://data.geo.admin.ch/ch.bav.schienennetz/schienennetz/schienennetz_2056_de.xtf";

export interface BavSegment {
  /** infrastructure operator abbreviation (e.g. SBB, BLS, RhB) when present */
  operator?: string;
  gauge?: string;
  coordinates: LonLat[];
}

const SEGMENT_OPEN = /<Schienennetz_LV95_V1_3\.Schienennetz\.Netzsegment\b/;
const SEGMENT_CLOSE = "</Schienennetz_LV95_V1_3.Schienennetz.Netzsegment>";
const COORD_RE = /<COORD>\s*<C1>([-\d.]+)<\/C1>\s*<C2>([-\d.]+)<\/C2>\s*<\/COORD>/g;
const OPERATOR_RE = /<Infrastrukturbetreiber>([^<]*)<\/Infrastrukturbetreiber>/;
const GAUGE_RE = /<Spurweite>([^<]*)<\/Spurweite>/;

/** Parses one `Netzsegment` element's XML into a segment (WGS84). */
export function parseSegmentXml(xml: string): BavSegment | undefined {
  const coords: LonLat[] = [];
  for (const m of xml.matchAll(COORD_RE)) {
    const east = Number(m[1]);
    const north = Number(m[2]);
    if (Number.isFinite(east) && Number.isFinite(north)) coords.push(lv95ToWgs84([east, north]));
  }
  if (coords.length < 2) return undefined;
  const seg: BavSegment = { coordinates: coords };
  const op = OPERATOR_RE.exec(xml)?.[1];
  const g = GAUGE_RE.exec(xml)?.[1];
  if (op) seg.operator = op;
  if (g) seg.gauge = g;
  return seg;
}

/** Streams the XTF file and yields segments without holding the whole file in memory. */
export async function readBavSegments(path: string): Promise<BavSegment[]> {
  const segments: BavSegment[] = [];
  let buffer = "";
  let inSegment = false;
  let segmentStart = 0;
  const stream = createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });
  for await (const chunk of stream) {
    buffer += chunk as string;
    let searchFrom = 0;
    for (;;) {
      if (!inSegment) {
        const m = SEGMENT_OPEN.exec(buffer.slice(searchFrom));
        if (!m) break;
        segmentStart = searchFrom + m.index;
        inSegment = true;
        searchFrom = segmentStart;
      }
      const end = buffer.indexOf(SEGMENT_CLOSE, searchFrom);
      if (end < 0) break;
      const xml = buffer.slice(segmentStart, end + SEGMENT_CLOSE.length);
      const seg = parseSegmentXml(xml);
      if (seg) segments.push(seg);
      inSegment = false;
      searchFrom = end + SEGMENT_CLOSE.length;
    }
    // keep only the unconsumed tail
    buffer = inSegment
      ? buffer.slice(segmentStart)
      : buffer.slice(Math.max(0, buffer.length - 4096));
    if (inSegment) segmentStart = 0;
  }
  return segments;
}

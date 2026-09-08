import { describe, expect, it } from "vitest";
import {
  buildStationIndex,
  normalizeStationName,
  parseTitle,
  sbbRecordsToEvents,
} from "../src/data-sources/transit/sbb-disruptions";

describe("SBB disruptions", () => {
  const index = buildStationIndex([
    { name: "Vauderens", lonLat: [6.88, 46.63] },
    { name: "Romont FR", lonLat: [6.92, 46.69] },
    { name: "Fribourg/Freiburg", lonLat: [7.15, 46.8] },
    { name: "Zürich HB", lonLat: [8.54, 47.38] },
  ]);
  it("normalises names and parses titles", () => {
    expect(normalizeStationName("Zürich HB")).toBe("zurich hb");
    expect(normalizeStationName("Fribourg/Freiburg (Gare)")).toBe("fribourg freiburg");
    expect(parseTitle("Limited service: Vauderens - Romont FR")).toEqual({
      kind: "limited service",
      stations: ["Vauderens", "Romont FR"],
    });
  });
  it("turns active records into line events and drops resumed / unmatched ones", () => {
    const now = new Date("2026-08-20T20:00:00Z");
    const events = sbbRecordsToEvents(
      [
        {
          title: "Limited service: Vauderens - Romont FR",
          startdatetime: "2026-08-20T19:33:00+00:00",
          enddatetime: "2026-08-20T22:33:00+00:00",
          link: "https://sbb.ch/x/1223295",
          description: "Limited train service.",
        },
        {
          title: "Service resumed: Vauderens - Romont FR",
          startdatetime: "2026-08-20T23:03:00+00:00",
          enddatetime: "2026-08-21T02:03:00+00:00",
        },
        {
          title: "Line interrupted: Nowhere - Elsewhere",
          startdatetime: "2026-08-20T19:00:00+00:00",
        },
        { title: "Line interrupted: Zürich HB", startdatetime: "2026-08-20T19:00:00+00:00" },
      ],
      index,
      now,
    );
    expect(events.map((e) => e.kind)).toEqual(["disruption", "closure"]);
    expect(events[0]!.geometry.type).toBe("LineString");
    expect(events[0]!.severity).toBe(3);
    expect(events[0]!.id).toBe("sbb-rti:1223295");
    expect(events[1]!.geometry.type).toBe("Point");
    expect(events[1]!.severity).toBe(4);
  });
});

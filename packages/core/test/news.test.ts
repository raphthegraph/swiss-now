import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseRss } from "../src/data-sources/news/rss";
import { categorize } from "../src/data-sources/news/categories";
import {
  buildGeocodeIndex,
  geocodeWithRegister,
  normalizeName,
  parseGazetteer,
  splitPolicePrefix,
} from "../src/data-sources/news/geocode";
import { dedupe, similarity } from "../src/data-sources/news/dedupe";
import { itemsToEvents } from "../src/data-sources/news/index";
import { GeoRegister, type GeoRegister as Register } from "../src/state/geo";
import { EventsState, NewsEvent } from "../src/state/events";

const fx = (f: string) => readFileSync(join(__dirname, "fixtures/news", f), "utf8");
const register: Register = GeoRegister.parse(
  JSON.parse(
    readFileSync(join(__dirname, "../../../apps/web/public/geo/municipalities-2026.json"), "utf8"),
  ),
);
const idx = buildGeocodeIndex(register);

describe("rss", () => {
  it("reads the police feed (CDATA categories) and the SRF feed", () => {
    const police = parseRss(fx("polizei-news.xml"), "polizei-news");
    expect(police.length).toBeGreaterThan(30);
    expect(police[0]!.title).toMatch(/^Basel BS:/);
    expect(police[0]!.categories).toContain("Basel-Stadt");
    expect(police[0]!.publishedAt).toBe("2026-09-08T14:28:00.000Z"); // feed times are UTC
    const srf = parseRss(fx("srf-schweiz.xml"), "srf-rss");
    expect(srf.length).toBeGreaterThan(30);
    expect(srf[0]!.url).toMatch(/^https:\/\/www\.srf\.ch\//);
  });
});

describe("categories", () => {
  it("classifies from feed categories and headlines", () => {
    expect(categorize("Bütschwil SG: Drei Autos kollidieren", ["Autounfälle"], "police")).toBe(
      "accident",
    );
    expect(
      categorize("Ingenbohl SZ: Feuerwehr setzt neu auf Drohne", ["Brände", "Feuerwehr"], "police"),
    ).toBe("fire");
    expect(categorize("Basel BS: Raubüberfall auf Laden", ["Kantonspolizei"], "police")).toBe(
      "crime",
    );
    expect(categorize("Wegen der Trockenheit – Neuer Speiseplan", [], "news")).toBe("news");
    expect(
      categorize(
        "Bütschwil SG: Drei Autos kollidieren auf H16",
        ["Autounfälle", "Feuerwehr"],
        "police",
      ),
    ).toBe("accident");
  });
});

describe("geocoding", () => {
  it("places police headlines by municipality and canton", () => {
    expect(normalizeName("St. Gallen")).toBe("st gallen");
    expect(splitPolicePrefix("Thalheim an der Thur ZH: Velofahrerin verletzt")).toEqual({
      place: "Thalheim an der Thur",
      canton: "ZH",
    });
    const bern = geocodeWithRegister(
      "Pieterlen BE: Auto und Motorrad kollidieren frontal",
      ["Bern"],
      idx,
    ).place!;
    expect(bern).toMatchObject({ method: "register", cantonCode: "BE", confidence: 0.95 });
    expect(bern.lonLat[0]).toBeCloseTo(7.44, 0);
    const sg = geocodeWithRegister(
      "St.Gallen SG: 18-jährige E-Scooterfahrerin verletzt",
      [],
      idx,
    ).place!;
    expect(sg).toMatchObject({ bfsNumber: 3203, confidence: 0.95 });
    const merged = geocodeWithRegister(
      "Bütschwil SG: Drei Autos kollidieren auf H16",
      [],
      idx,
    ).place!;
    expect(merged.name).toBe("Bütschwil-Ganterschwil");
    const thur = geocodeWithRegister(
      "Thalheim an der Thur ZH: Velofahrerin bei Kollision verletzt",
      [],
      idx,
    ).place!;
    expect(thur.cantonCode).toBe("ZH");
  });
  it("finds municipality names inside SRF headlines and falls back to cantons", () => {
    const stadel = geocodeWithRegister(
      "Atomendlager in Stadel ZH – so reagiert die Region",
      [],
      idx,
    );
    expect(stadel.place?.method).toBe("register");
    expect(stadel.place?.cantonCode).toBe("ZH");
    const unknownPlace = geocodeWithRegister("Hinterwald SZ: Hütte abgebrannt", [], idx);
    expect(unknownPlace.place).toBeUndefined();
    expect(unknownPlace.gazetteerQuery).toBe("Hinterwald");
    expect(unknownPlace.cantonHint).toBe("SZ");
    const canton = geocodeWithRegister("Bundesgericht stützt Kanton Thurgau", [], idx);
    expect(canton.place?.method).toBe("canton-centroid");
  });
  it("reads gazetteer hits", () => {
    const p = parseGazetteer(
      {
        results: [
          {
            attrs: {
              lat: 46.62,
              lon: 6.85,
              label: "<b>Vauderens</b> (FR)",
              origin: "gazetteer",
              detail: "vauderens fr",
            },
          },
        ],
      },
      "Vauderens",
      "FR",
    )!;
    expect(p).toMatchObject({ method: "gazetteer", confidence: 0.7, cantonCode: "FR" });
  });
});

describe("dedupe and pipeline", () => {
  it("drops near-identical headlines within six hours and builds valid events", () => {
    expect(
      similarity(
        "Pieterlen BE: Auto und Motorrad kollidieren frontal",
        "Pieterlen BE: Motorrad kracht frontal in Auto",
      ),
    ).toBeLessThan(0.8);
    expect(
      similarity(
        "Basel BS: Raubüberfall auf Laden",
        "Basel BS: Raubüberfall auf Laden – Täter flüchtig",
      ),
    ).toBeGreaterThan(0.8);
    const items = [
      ...parseRss(fx("polizei-news.xml"), "polizei-news"),
      ...parseRss(fx("srf-schweiz.xml"), "srf-rss"),
    ];
    const entries = itemsToEvents(items, idx, (s) => (s === "polizei-news" ? "police" : "news"));
    const events = dedupe(entries.map((e) => e.event));
    for (const e of events) expect(NewsEvent.parse(e)).toBeTruthy();
    const placed = events.filter((e) => e.place);
    expect(placed.length).toBeGreaterThan(12);
    expect(events.filter((e) => e.source === "polizei-news").length).toBeGreaterThan(15); // foreign items dropped
    expect(events.some((e) => e.source === "polizei-news" && e.place?.confidence === 0.95)).toBe(
      true,
    );
    expect(events.every((e) => !/Saarland/.test(e.headline.de))).toBe(true);
    expect(
      EventsState.parse({
        schemaVersion: 1,
        updatedAt: "2026-09-08T15:00:00Z",
        observedAt: "2026-09-08T14:00:00Z",
        freshness: "live",
        sources: ["polizei-news"],
        events,
        windowHours: 24,
      }),
    ).toBeTruthy();
  });
});

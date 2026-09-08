/**
 * Geocoding headlines with the geo spine first and the swisstopo gazetteer second:
 * 1. `Ort KT: …` (police feeds) → municipality by name within the canton (0.95), by name alone (0.8)
 * 2. a municipality name anywhere in the headline (unique, ≥ 5 letters) → 0.6
 * 3. gazetteer lookup of the `Ort` part (async, cached by the caller) → 0.7
 * 4. only a canton recognisable → the canton centroid (0.3), rendered as a label, never a point
 */
import type { EventPlace } from "../../state/events";
import type { CantonCode, LonLat } from "../../state/common";
import { CantonCode as CantonSchema } from "../../state/common";
import type { GeoRegister, MunicipalityRef } from "../../state/geo";

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bst\.?\s*/g, "st ")
    .replace(/\bsaint[- ]/g, "st ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface GeocodeIndex {
  byName: Map<string, MunicipalityRef[]>;
  cantonCentroids: Partial<Record<CantonCode, LonLat>>;
  cantonByName: Map<string, CantonCode>;
}

export function buildGeocodeIndex(register: GeoRegister): GeocodeIndex {
  const byName = new Map<string, MunicipalityRef[]>();
  for (const m of register.municipalities) {
    if (!m.lonLat) continue;
    // "Thalheim an der Thur" → also "thalheim"; "Biel/Bienne" → "biel", "bienne"
    const keys = new Set<string>([normalizeName(m.name)]);
    for (const part of m.name.split(/[/(]/)) keys.add(normalizeName(part));
    // merged municipalities keep their old names as parts: "Bütschwil-Ganterschwil"
    const parts = m.name.split("-");
    if (parts.length === 2 && parts.every((p) => p.length >= 4))
      for (const p of parts) keys.add(normalizeName(p));
    keys.add(normalizeName(m.name.replace(/\s+(an|am|bei|im|ob|unter|ober)\b.*$/i, "")));
    for (const k of keys) {
      if (!k) continue;
      const arr = byName.get(k) ?? [];
      if (!arr.includes(m)) arr.push(m);
      byName.set(k, arr);
    }
  }
  const cantonCentroids: Partial<Record<CantonCode, LonLat>> = {};
  const cantonByName = new Map<string, CantonCode>();
  for (const [code, c] of Object.entries(register.cantons)) {
    const parsed = CantonSchema.safeParse(code);
    if (!parsed.success) continue;
    if (c.lonLat) cantonCentroids[parsed.data] = c.lonLat;
    for (const part of c.name.split("/")) cantonByName.set(normalizeName(part), parsed.data);
    cantonByName.set(normalizeName(code), parsed.data);
  }
  return { byName, cantonCentroids, cantonByName };
}

const place = (m: MunicipalityRef, confidence: number): EventPlace => ({
  name: m.name,
  bfsNumber: m.bfs,
  cantonCode: m.canton,
  lonLat: m.lonLat!,
  confidence,
  method: "register",
});

/** The `Ort KT` prefix of police headlines. */
export function splitPolicePrefix(
  title: string,
): { place: string; canton: CantonCode | undefined } | undefined {
  const m = /^([^:–-]{2,60}?)\s+([A-Z]{2})\s*:/.exec(title);
  if (!m) return undefined;
  const canton = CantonSchema.safeParse(m[2]);
  return { place: m[1]!.trim(), canton: canton.success ? canton.data : undefined };
}

export interface GeocodeResult {
  place: EventPlace | undefined;
  /** the text to try in the gazetteer when the register had no match */
  gazetteerQuery?: string;
  cantonHint?: CantonCode;
}

export function geocodeWithRegister(
  title: string,
  categories: string[],
  idx: GeocodeIndex,
): GeocodeResult {
  const prefix = splitPolicePrefix(title);
  if (prefix) {
    const cands = idx.byName.get(normalizeName(prefix.place)) ?? [];
    const inCanton = prefix.canton ? cands.filter((c) => c.canton === prefix.canton) : cands;
    if (inCanton.length === 1) return { place: place(inCanton[0]!, prefix.canton ? 0.95 : 0.8) };
    if (inCanton.length > 1) return { place: place(inCanton[0]!, 0.5) };
    if (cands.length === 1) return { place: place(cands[0]!, 0.6) };
    const out: GeocodeResult = { place: undefined, gazetteerQuery: prefix.place };
    if (prefix.canton) out.cantonHint = prefix.canton;
    return out;
  }
  // a unique municipality name inside the headline (longest first)
  const words = normalizeName(title).split(" ");
  let best: { m: MunicipalityRef; len: number } | undefined;
  for (let i = 0; i < words.length; i++) {
    for (let n = 3; n >= 1; n--) {
      const key = words.slice(i, i + n).join(" ");
      if (key.length < 5) continue;
      const cands = idx.byName.get(key);
      if (cands?.length === 1 && (!best || key.length > best.len))
        best = { m: cands[0]!, len: key.length };
    }
  }
  if (best) return { place: place(best.m, 0.6) };
  // a canton name in the headline or the feed categories → its centroid
  const hay = `${categories.join(" ")} ${title}`;
  for (const [name, code] of idx.cantonByName) {
    if (name.length >= 4 && normalizeName(hay).includes(name)) {
      const lonLat = idx.cantonCentroids[code];
      if (lonLat)
        return {
          place: {
            name: name,
            cantonCode: code,
            lonLat,
            confidence: 0.3,
            method: "canton-centroid",
          },
        };
    }
  }
  return { place: undefined };
}

/** swisstopo SearchServer (free incl. commercial): the first location hit for a place name. */
export function gazetteerUrl(query: string): string {
  return `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(query)}&type=locations&origins=gazetteer,gg25&sr=4326&limit=3`;
}
interface SearchServerJson {
  results?: {
    attrs: { lat: number; lon: number; label: string; origin?: string; detail?: string };
  }[];
}
export function parseGazetteer(
  json: SearchServerJson,
  query: string,
  cantonHint?: CantonCode,
): EventPlace | undefined {
  const hits = json.results ?? [];
  const pick =
    hits.find(
      (h) =>
        cantonHint &&
        normalizeName(h.attrs.detail ?? h.attrs.label).includes(normalizeName(cantonHint)),
    ) ?? hits[0];
  if (!pick || !Number.isFinite(pick.attrs.lat)) return undefined;
  const out: EventPlace = {
    name: query,
    lonLat: [pick.attrs.lon, pick.attrs.lat],
    confidence: pick.attrs.origin === "gg25" ? 0.75 : 0.7,
    method: "gazetteer",
  };
  if (cantonHint) out.cantonCode = cantonHint;
  return out;
}

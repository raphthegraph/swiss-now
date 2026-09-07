import type { CantonCode, LonLat } from "@swiss-now/core";

export interface Place {
  id: string;
  name: string;
  cantonCode: CantonCode;
  lonLat: LonLat;
}

/** Canton capitals plus the other large cities — enough for a one-tap home place without search. */
export const PLACES: Place[] = [
  { id: "zurich", name: "Zürich", cantonCode: "ZH", lonLat: [8.5417, 47.3769] },
  { id: "geneve", name: "Genève", cantonCode: "GE", lonLat: [6.1432, 46.2044] },
  { id: "basel", name: "Basel", cantonCode: "BS", lonLat: [7.5886, 47.5596] },
  { id: "lausanne", name: "Lausanne", cantonCode: "VD", lonLat: [6.6323, 46.5197] },
  { id: "bern", name: "Bern", cantonCode: "BE", lonLat: [7.4474, 46.948] },
  { id: "winterthur", name: "Winterthur", cantonCode: "ZH", lonLat: [8.7241, 47.4988] },
  { id: "luzern", name: "Luzern", cantonCode: "LU", lonLat: [8.3093, 47.0502] },
  { id: "st-gallen", name: "St. Gallen", cantonCode: "SG", lonLat: [9.3767, 47.4245] },
  { id: "lugano", name: "Lugano", cantonCode: "TI", lonLat: [8.9511, 46.0037] },
  { id: "biel", name: "Biel/Bienne", cantonCode: "BE", lonLat: [7.2474, 47.1368] },
  { id: "thun", name: "Thun", cantonCode: "BE", lonLat: [7.628, 46.758] },
  { id: "bellinzona", name: "Bellinzona", cantonCode: "TI", lonLat: [9.0244, 46.1927] },
  { id: "fribourg", name: "Fribourg", cantonCode: "FR", lonLat: [7.1618, 46.8065] },
  { id: "schaffhausen", name: "Schaffhausen", cantonCode: "SH", lonLat: [8.6339, 47.6961] },
  { id: "chur", name: "Chur", cantonCode: "GR", lonLat: [9.5329, 46.8499] },
  { id: "neuchatel", name: "Neuchâtel", cantonCode: "NE", lonLat: [6.9293, 46.9931] },
  { id: "sion", name: "Sion", cantonCode: "VS", lonLat: [7.3599, 46.2331] },
  { id: "aarau", name: "Aarau", cantonCode: "AG", lonLat: [8.0446, 47.3907] },
  { id: "zug", name: "Zug", cantonCode: "ZG", lonLat: [8.5156, 47.1662] },
  { id: "solothurn", name: "Solothurn", cantonCode: "SO", lonLat: [7.5379, 47.208] },
  { id: "schwyz", name: "Schwyz", cantonCode: "SZ", lonLat: [8.6539, 47.0207] },
  { id: "liestal", name: "Liestal", cantonCode: "BL", lonLat: [7.7343, 47.4842] },
  { id: "frauenfeld", name: "Frauenfeld", cantonCode: "TG", lonLat: [8.8966, 47.5578] },
  { id: "glarus", name: "Glarus", cantonCode: "GL", lonLat: [9.0679, 47.0404] },
  { id: "herisau", name: "Herisau", cantonCode: "AR", lonLat: [9.2792, 47.3861] },
  { id: "appenzell", name: "Appenzell", cantonCode: "AI", lonLat: [9.4089, 47.3306] },
  { id: "sarnen", name: "Sarnen", cantonCode: "OW", lonLat: [8.2458, 46.8961] },
  { id: "stans", name: "Stans", cantonCode: "NW", lonLat: [8.3661, 46.958] },
  { id: "altdorf", name: "Altdorf", cantonCode: "UR", lonLat: [8.6444, 46.8804] },
  { id: "delemont", name: "Delémont", cantonCode: "JU", lonLat: [7.3446, 47.3647] },
];

export function nearestPlace(lonLat: LonLat): Place {
  let best = PLACES[0]!;
  let bestD = Infinity;
  for (const p of PLACES) {
    const dx = (p.lonLat[0] - lonLat[0]) * Math.cos((lonLat[1] * Math.PI) / 180);
    const dy = p.lonLat[1] - lonLat[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

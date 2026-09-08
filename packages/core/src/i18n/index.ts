/**
 * Languages of the interface: the three large national languages and English. Text travels as
 * `LocalizedText` (state/common.ts); `pick` resolves it for a language with `en` then `de` as the
 * fallback chain. Romansh stays a data language (station names may carry it) but is not offered.
 */
import type { LocalizedText } from "../state/common";

export type UiLang = "de" | "fr" | "it" | "en";
export const UI_LANGS: readonly UiLang[] = ["de", "fr", "it", "en"];

export function isUiLang(x: unknown): x is UiLang {
  return typeof x === "string" && (UI_LANGS as readonly string[]).includes(x);
}

/** Text for a language; `en` then `de` when the language is missing. */
export function pick(text: LocalizedText | string | undefined, lang: UiLang): string {
  if (text === undefined) return "";
  if (typeof text === "string") return text;
  return text[lang] ?? text.en ?? text.de;
}

/** Four-language literal. Order: de, en, fr, it (the order labels are written in the code). */
export const t = (de: string, en: string, fr: string, it: string): LocalizedText => ({
  de,
  en,
  fr,
  it,
});

/** Appends a localized suffix to every language of a text (missing languages fall back first). */
export function withSuffix(text: LocalizedText, suffix: LocalizedText): LocalizedText {
  return t(
    `${text.de}${suffix.de}`,
    `${pick(text, "en")}${pick(suffix, "en")}`,
    `${pick(text, "fr")}${pick(suffix, "fr")}`,
    `${pick(text, "it")}${pick(suffix, "it")}`,
  );
}

/** Intl locale per language, Swiss variants so separators and month names match the country. */
export const LOCALE: Record<UiLang, string> = {
  de: "de-CH",
  fr: "fr-CH",
  it: "it-CH",
  en: "en-GB",
};

/**
 * Figure labels shared by the HUD strip, compare, charts, the story and the video. One entry per
 * label so the same figure reads the same everywhere.
 */
export const FL = {
  warmest: t("Wärmster Ort", "Warmest", "Le plus chaud", "Il più caldo"),
  coldest: t("Kältester Ort", "Coldest", "Le plus froid", "Il più freddo"),
  strongestGust: t("Stärkste Böe", "Strongest gust", "Rafale la plus forte", "Raffica più forte"),
  stationsRain: t(
    "Stationen mit Regen",
    "Stations reporting rain",
    "Stations avec pluie",
    "Stazioni con pioggia",
  ),
  deepestSnow: t("Meiste Schnee", "Deepest snow", "Neige la plus épaisse", "Neve più alta"),
  rhineBasel: t("Rhein bei Basel", "Rhine at Basel", "Rhin à Bâle", "Reno a Basilea"),
  warmestRiver: t("Wärmster Fluss", "Warmest river", "Rivière la plus chaude", "Fiume più caldo"),
  floodDanger: t("Hochwassergefahr", "Flood danger", "Danger de crue", "Pericolo di piena"),
  onTime: t("Pünktlich", "On time", "À l'heure", "In orario"),
  largestDelay: t("Grösste Verspätung", "Largest delay", "Plus grand retard", "Ritardo maggiore"),
  trainsRunning: t("Züge unterwegs", "Trains running", "Trains en circulation", "Treni in corsa"),
  cancelled: t("Ausfälle", "Cancelled", "Annulés", "Soppressi"),
  disruptions: t("Störungen", "Disruptions", "Perturbations", "Perturbazioni"),
  lastQuake: t("Letztes Erdbeben", "Last earthquake", "Dernier séisme", "Ultimo terremoto"),
  strongest: t("Stärkstes", "Strongest", "Le plus fort", "Il più forte"),
  yes: t("Ja", "Yes", "Oui", "Sì"),
  turnout: t("Stimmbeteiligung", "Turnout", "Participation", "Partecipazione"),
  cantons: t("Kantone", "Cantons", "Cantons", "Cantoni"),
  municipalities: t("Gemeinden", "Municipalities", "Communes", "Comuni"),
  nextVote: t(
    "Nächster Abstimmungssonntag",
    "Next vote Sunday",
    "Prochaine votation",
    "Prossima votazione",
  ),
  vsNational: t(
    "Gegenüber der Schweiz",
    "Against Switzerland",
    "Face à la Suisse",
    "Rispetto alla Svizzera",
  ),
  rank: t("Rang", "Rank", "Rang", "Posizione"),
  highest: t("Höchster Wert", "Highest", "Valeur la plus haute", "Valore più alto"),
  lowest: t("Tiefster Wert", "Lowest", "Valeur la plus basse", "Valore più basso"),
  netImport: t("Nettoimport", "Net import", "Importation nette", "Importazione netta"),
  netExport: t("Nettoexport", "Net export", "Exportation nette", "Esportazione netta"),
  gridFrequency: t("Netzfrequenz", "Grid frequency", "Fréquence du réseau", "Frequenza di rete"),
  dayAheadPrice: t("Day-Ahead-Preis", "Day-ahead price", "Prix day-ahead", "Prezzo day-ahead"),
  price: t("Preis", "Price", "Prix", "Prezzo"),
  renewableShare: t(
    "Anteil erneuerbar",
    "Renewable share",
    "Part renouvelable",
    "Quota rinnovabile",
  ),
  renewable: t("Erneuerbar", "Renewable", "Renouvelable", "Rinnovabile"),
  eventsInWindow: t(
    "Ereignisse im Fenster",
    "Events in the window",
    "Événements dans la fenêtre",
    "Eventi nella finestra",
  ),
  events6h: t("Ereignisse, 6 h", "Events, 6 h", "Événements, 6 h", "Eventi, 6 h"),
  events24h: t("Ereignisse, 24 h", "Events, 24 h", "Événements, 24 h", "Eventi, 24 h"),
  placedOnMap: t("Auf der Karte", "Placed on the map", "Sur la carte", "Sulla carta"),
  placed: t("Verortet", "Placed", "Localisés", "Localizzati"),
  mostEvents: t("Meiste Ereignisse", "Most events", "Le plus d'événements", "Più eventi"),
  airQuality: t("Luftqualität", "Air quality", "Qualité de l'air", "Qualità dell'aria"),
  airIndex: t("Luftindex", "Air index", "Indice de l'air", "Indice dell'aria"),
  pm25: t("PM2.5", "PM2.5", "PM2.5", "PM2.5"),
  citizenSensors: t("Bürgersensoren", "Citizen sensors", "Capteurs citoyens", "Sensori cittadini"),
  pollen: t("Pollen", "Pollen", "Pollen", "Polline"),
  fireDanger: t(
    "Waldbrandgefahr",
    "Forest-fire danger",
    "Danger d'incendie de forêt",
    "Pericolo d'incendio",
  ),
  fireDangerShort: t("Waldbrand", "Fire danger", "Feux de forêt", "Incendi"),
  regions3: t("Regionen ≥ 3", "Regions ≥ 3", "Régions ≥ 3", "Regioni ≥ 3"),
  avalancheDanger: t(
    "Lawinengefahr",
    "Avalanche danger",
    "Danger d'avalanche",
    "Pericolo valanghe",
  ),
  hail: t("Hagel", "Hail", "Grêle", "Grandine"),
  rainingOver: t("Regen über", "Raining over", "Pluie sur", "Pioggia su"),
  rain24h: t("24 h", "24 h", "24 h", "24 h"),
  lowestOnTime: t(
    "Tiefste Pünktlichkeit",
    "Lowest on time",
    "Ponctualité minimale",
    "Puntualità minima",
  ),
  trainsNow: t("Züge jetzt", "Trains now", "Trains maintenant", "Treni ora"),
  discharge: t("Abfluss", "Discharge", "Débit", "Deflusso"),
  dangerLevel: t("Gefahrenstufe", "Danger level", "Niveau de danger", "Grado di pericolo"),
  magnitude: t("Magnitude", "Magnitude", "Magnitude", "Magnitudo"),
  depth: t("Tiefe", "Depth", "Profondeur", "Profondità"),
  gust: t("Böe", "Gust", "Rafale", "Raffica"),
  snowDepth: t("Schneehöhe", "Snow depth", "Hauteur de neige", "Altezza neve"),
  temperature: t("Temperatur", "Temperature", "Température", "Temperatura"),
  rain10min: t("Regen, 10 min", "Rain, 10 min", "Pluie, 10 min", "Pioggia, 10 min"),
  river: t("Fluss", "River", "Rivière", "Fiume"),
  water: t("Wasser", "Water", "Eau", "Acqua"),
} as const satisfies Record<string, LocalizedText>;
export type FigureLabelKey = keyof typeof FL;

/** Event categories (state/events.ts), singular and plural, for markers, cards and the story. */
export const EVENT_CATEGORY = {
  fire: {
    one: t("Brand", "Fire", "Incendie", "Incendio"),
    many: t("Brände", "fires", "incendies", "incendi"),
  },
  accident: {
    one: t("Unfall", "Accident", "Accident", "Incidente"),
    many: t("Unfälle", "accidents", "accidents", "incidenti"),
  },
  "natural-hazard": {
    one: t("Naturereignis", "Natural hazard", "Danger naturel", "Pericolo naturale"),
    many: t("Naturereignisse", "natural hazards", "dangers naturels", "pericoli naturali"),
  },
  avalanche: {
    one: t("Lawine", "Avalanche", "Avalanche", "Valanga"),
    many: t("Lawinen", "avalanches", "avalanches", "valanghe"),
  },
  crime: {
    one: t("Polizeifall", "Police case", "Affaire de police", "Caso di polizia"),
    many: t("Polizeifälle", "police cases", "affaires de police", "casi di polizia"),
  },
  police: {
    one: t("Polizei", "Police", "Police", "Polizia"),
    many: t("Polizeimeldungen", "police reports", "communiqués de police", "comunicati di polizia"),
  },
  news: {
    one: t("Meldung", "News", "Actualité", "Notizia"),
    many: t("Meldungen", "news items", "actualités", "notizie"),
  },
} as const satisfies Record<string, { one: LocalizedText; many: LocalizedText }>;

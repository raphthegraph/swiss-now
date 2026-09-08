/** The few fixed phrases of the composition, in the interface languages (data text arrives localized). */
import { TOPICS, type TopicId } from "@swiss-now/core/topics";
import { LOCALE, pick, t, type UiLang } from "@swiss-now/core/i18n";
import type { Chapter } from "@swiss-now/core";

export const VIDEO_STRINGS = {
  dayIn: t(
    "Der Tag in {n} Kapiteln",
    "The day in {n} chapters",
    "La journée en {n} chapitres",
    "La giornata in {n} capitoli",
  ),
  switzerland: t("Die Schweiz", "Switzerland", "La Suisse", "La Svizzera"),
  today: t("heute", "today", "aujourd'hui", "oggi"),
  sources: t("Quellen", "Sources", "Sources", "Fonti"),
  assembled: t(
    "Automatisch um {time} aus den Momentaufnahmen des Tages zusammengestellt. Zugpositionen sind aus Fahrplan und Live-Verspätungen geschätzt; die Werte tragen auf der Website ihre Beobachtungszeit.",
    "Assembled automatically at {time} from the day's snapshots. Train positions are estimated from the timetable and live delays; values carry their observation time on the website.",
    "Assemblé automatiquement à {time} à partir des instantanés du jour. Les positions des trains sont estimées d'après l'horaire et les retards en direct ; les valeurs portent leur heure d'observation sur le site.",
    "Assemblato automaticamente alle {time} dalle istantanee del giorno. Le posizioni dei treni sono stimate da orario e ritardi in tempo reale; i valori portano l'ora di osservazione sul sito.",
  ),
} as const;

export function vs(
  key: keyof typeof VIDEO_STRINGS,
  lang: UiLang,
  vars?: Record<string, string | number>,
): string {
  let s = pick(VIDEO_STRINGS[key], lang);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

/** The topic a chapter belongs to, for its small-caps label. */
export function chapterTopic(c: Chapter): TopicId {
  switch (c.layer) {
    case "hydrology":
      return "water";
    case "seismic":
    case "hazards":
      return "hazards";
    case "rail":
    case "energy":
    case "events":
    case "air":
    case "politics":
      return c.layer;
    default:
      return "weather";
  }
}

export function chapterTopicLabel(c: Chapter, lang: UiLang): string {
  return pick(TOPICS[chapterTopic(c)].label, lang);
}

export function formatStoryDate(date: string, lang: UiLang = "en"): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(new Date(`${date}T12:00:00+02:00`));
}

export function formatClock(iso: string, lang: UiLang = "en"): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Zurich",
  }).format(new Date(iso));
}

import { LOCALE, type UiLang } from "@swiss-now/core/i18n";
import { formatNumber as formatDeterministic } from "@swiss-now/motion";

const zurich = "Europe/Zurich";

/** `21:07` in Swiss time. */
export function formatTime(iso: string, lang: UiLang = "en"): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zurich,
  }).format(new Date(iso));
}

/** Deterministic Swiss formatting (’ thousands separator): identical on server and client. */
export function formatNumber(value: number, decimals = 1): string {
  return formatDeterministic(value, decimals);
}

/** `2026-06-14` → `14 June 2026` / `14. Juni 2026` (month names are stable across ICUs, unlike separators). */
export function formatDate(isoDate: string, lang: UiLang = "en"): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: zurich,
  }).format(new Date(`${isoDate.slice(0, 10)}T12:00:00+02:00`));
}

/** Short date and time, `08.09.2026, 21:07`. */
export function formatDateTime(iso: string, lang: UiLang = "en"): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: zurich,
  }).format(new Date(iso));
}

const AGO: Record<UiLang, { min: string; h: string; d: string }> = {
  de: { min: "vor {n} Min.", h: "vor {h} h {m} Min.", d: "vor {n} Tagen" },
  en: { min: "{n} min ago", h: "{h} h {m} min ago", d: "{n} days ago" },
  fr: { min: "il y a {n} min", h: "il y a {h} h {m} min", d: "il y a {n} jours" },
  it: { min: "{n} min fa", h: "{h} h {m} min fa", d: "{n} giorni fa" },
};

/** `35 min ago`, `6 h 45 min ago`, `2 days ago`. */
export function formatAgo(ms: number, lang: UiLang = "en"): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  const a = AGO[lang];
  if (min < 90) return a.min.replace("{n}", String(min));
  const h = Math.floor(min / 60);
  if (h < 48) return a.h.replace("{h}", String(h)).replace("{m}", String(min - h * 60));
  return a.d.replace("{n}", String(Math.round(h / 24)));
}

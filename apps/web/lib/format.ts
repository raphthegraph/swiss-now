const zurich = "Europe/Zurich";

export function formatTime(iso: string, locale = "de-CH"): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zurich,
  }).format(new Date(iso));
}

import { formatNumber as formatDeterministic } from "@swiss-now/motion";

/** Deterministic Swiss formatting (’ thousands separator): identical on server and client. */
export function formatNumber(value: number, decimals = 1): string {
  return formatDeterministic(value, decimals);
}

/** `2026-06-14` → `14 June 2026` (month names are stable across ICUs, unlike separators). */
export function formatDate(isoDate: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(new Date(`${isoDate.slice(0, 10)}T12:00:00+02:00`));
}

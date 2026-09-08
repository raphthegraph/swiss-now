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

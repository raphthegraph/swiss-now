const zurich = "Europe/Zurich";

export function formatTime(iso: string, locale = "de-CH"): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: zurich,
  }).format(new Date(iso));
}

export function formatNumber(value: number, decimals = 1, locale = "de-CH"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

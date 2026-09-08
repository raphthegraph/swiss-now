/**
 * Deterministic number formatting in the Swiss convention (’ thousands separator, . decimal).
 * Not Intl: server and browser ICUs disagree on the apostrophe for de-CH, which broke hydration.
 */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "–";
  const sign = value < 0 ? "−" : "";
  const [int, frac] = Math.abs(value).toFixed(decimals).split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  return sign + grouped + (frac ? `.${frac}` : "");
}

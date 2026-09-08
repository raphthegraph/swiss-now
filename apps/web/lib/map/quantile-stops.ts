/**
 * Sequential colour stops from the data's quantiles, so a few large cities do not flatten the map
 * (docs/IA.md). Colours run paper → accent; the domain is the 5th … 95th percentile.
 */
export function quantileStops(values: number[], colors: string[]): [number, string][] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length < 2) return colors.map((c, i) => [i, c]);
  const q = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))]!;
  const lo = 0.05;
  const hi = 0.95;
  const stops: [number, string][] = [];
  let last = -Infinity;
  colors.forEach((c, i) => {
    let v = q(lo + ((hi - lo) * i) / (colors.length - 1));
    if (v <= last) v = last + Math.max(1e-6, Math.abs(last) * 1e-6);
    last = v;
    stops.push([v, c]);
  });
  return stops;
}

/** Paper → accent ramp with a mid tint, five steps. */
export function sequentialRamp(accent: string): string[] {
  return [
    "#F4F3EF",
    mix("#F4F3EF", accent, 0.3),
    mix("#F4F3EF", accent, 0.55),
    accent,
    mix(accent, "#111214", 0.35),
  ];
}

function mix(a: string, b: string, t: number): string {
  const pa = hex(a);
  const pb = hex(b);
  const c = pa.map((x, i) => Math.round(x + (pb[i]! - x) * t));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
function hex(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

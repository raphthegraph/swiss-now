import type { NewsEvent } from "../../state/events";
import { normalizeName } from "./geocode";

function trigrams(s: string): Set<string> {
  const t = ` ${normalizeName(s)} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}
export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let common = 0;
  for (const g of ta) if (tb.has(g)) common++;
  return common / Math.max(1, Math.min(ta.size, tb.size));
}

/** Keeps the earliest of near-identical headlines published within 6 hours (across feeds). */
export function dedupe(events: NewsEvent[], threshold = 0.8): NewsEvent[] {
  const sorted = [...events].sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : 1));
  const kept: NewsEvent[] = [];
  for (const e of sorted) {
    const t = new Date(e.publishedAt).getTime();
    const dup = kept.some(
      (k) =>
        Math.abs(new Date(k.publishedAt).getTime() - t) < 6 * 3_600_000 &&
        similarity(k.headline.de, e.headline.de) >= threshold,
    );
    if (!dup) kept.push(e);
  }
  return kept.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

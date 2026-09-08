/**
 * BFS STAT-TAB PxWeb API v1 (JSON-stat2). Verified 2026-09-08: 5 000 values per call, 50 calls per
 * 15 s, some cubes only under /de/. Cube ids are configuration, not code.
 */
import { SWISS_NOW_USER_AGENT } from "../geoadmin/client";

export const PXWEB_BASE = "https://www.pxweb.bfs.admin.ch/api/v1";
export type PxLang = "de" | "fr" | "it" | "en";

export interface PxVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  elimination?: boolean;
  time?: boolean;
}
export interface PxMeta {
  title: string;
  variables: PxVariable[];
}
export interface PxSelection {
  code: string;
  selection: { filter: "all" | "item"; values: string[] };
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const headers = { "user-agent": SWISS_NOW_USER_AGENT, accept: "application/json" };

export async function pxwebMeta(
  cube: string,
  lang: PxLang,
  fetchFn: FetchLike = fetch,
): Promise<PxMeta> {
  const res = await fetchFn(`${PXWEB_BASE}/${lang}/${cube}/${cube}.px`, { headers });
  if (!res.ok) throw new Error(`pxweb meta ${res.status} ${cube}`);
  return (await res.json()) as PxMeta;
}

export async function pxwebQuery(
  cube: string,
  lang: PxLang,
  query: PxSelection[],
  fetchFn: FetchLike = fetch,
): Promise<JsonStat2> {
  const res = await fetchFn(`${PXWEB_BASE}/${lang}/${cube}/${cube}.px`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } }),
  });
  if (!res.ok) throw new Error(`pxweb query ${res.status} ${cube}`);
  return (await res.json()) as JsonStat2;
}

/** The subset of JSON-stat 2.0 we read. */
export interface JsonStat2 {
  id: string[];
  size: number[];
  dimension: Record<
    string,
    { category: { index: Record<string, number> | string[]; label?: Record<string, string> } }
  >;
  value: (number | null)[];
  updated?: string;
}

/** Category codes of a dimension in index order. */
export function categoryCodes(d: JsonStat2, dim: string): string[] {
  const idx = d.dimension[dim]?.category.index;
  if (!idx) throw new Error(`jsonstat: no dimension ${dim}`);
  if (Array.isArray(idx)) return idx;
  return Object.entries(idx)
    .sort((a, b) => a[1] - b[1])
    .map(([code]) => code);
}

/** Value at the given category positions (row-major over `id` order). */
export function valueAt(d: JsonStat2, positions: number[]): number | null {
  let offset = 0;
  for (let i = 0; i < d.id.length; i++) offset = offset * d.size[i]! + positions[i]!;
  return d.value[offset] ?? null;
}

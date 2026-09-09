import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { IndicatorCatalog, IndicatorSeries } from "@swiss-now/core/state";

/** Static data built by `build-data stats`: a local directory or a public base URL (Blob). */
const DATA_DIR = process.env["DATA_DIR"] ?? join(process.cwd(), "public", "data");
const DATA_URL = process.env["DATA_BASE_URL"]?.replace(/\/$/, "");
export const STATS_TTL_SECONDS = 3600;
const cache = new Map<string, { at: number; value: unknown }>();

async function readJson<T>(path: string, parse: (x: unknown) => T): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < STATS_TTL_SECONDS * 1000) return hit.value as T;
  let raw: unknown;
  if (DATA_URL) {
    const res = await fetch(`${DATA_URL}/${path}`, { next: { revalidate: STATS_TTL_SECONDS } });
    if (!res.ok) throw new Error(`data ${res.status} ${path}`);
    raw = await res.json();
  } else raw = JSON.parse(await readFile(join(DATA_DIR, path), "utf8"));
  const value = parse(raw);
  cache.set(path, { at: Date.now(), value });
  return value;
}

export function getIndicatorCatalog(): Promise<IndicatorCatalog> {
  return readJson("stats/index.json", (x) => IndicatorCatalog.parse(x));
}

export function getIndicator(id: string): Promise<IndicatorSeries> {
  return readJson(`stats/${id}.json`, (x) => IndicatorSeries.parse(x));
}

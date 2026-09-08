/** Minimal RSS 2.0 reading for the news feeds (fast-xml-parser, MIT). */
import { XMLParser } from "fast-xml-parser";
import type { SourceId } from "../../sources/ids";

export interface RawItem {
  source: SourceId;
  title: string;
  url: string;
  publishedAt: string;
  categories: string[];
  description?: string;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  cdataPropName: "__cdata",
  trimValues: true,
});

const text = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("__cdata" in o) return text(o["__cdata"]);
    if ("#text" in o) return text(o["#text"]);
    return "";
  }
  return String(v);
};

export function parseRss(xml: string, source: SourceId): RawItem[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  const items = doc.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  const out: RawItem[] = [];
  for (const raw of list as Record<string, unknown>[]) {
    const title = decode(text(raw["title"]));
    const url = text(raw["link"]);
    const date = new Date(text(raw["pubDate"]));
    if (!title || !url || Number.isNaN(date.getTime())) continue;
    const cats = raw["category"];
    const categories = (Array.isArray(cats) ? cats : cats ? [cats] : []).map(text).filter(Boolean);
    const item: RawItem = { source, title, url, publishedAt: date.toISOString(), categories };
    const desc = text(raw["description"]);
    if (desc) item.description = decode(desc.replace(/<[^>]+>/g, "")).trim();
    out.push(item);
  }
  return out;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

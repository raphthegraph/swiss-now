/**
 * Static data files built by `build-data` (docs/IA.md §2): under `public/data/` in development
 * and on Vercel Blob once deployed (`NEXT_PUBLIC_DATA_BASE_URL`). Same layout in both places.
 */
export const DATA_BASE = process.env["NEXT_PUBLIC_DATA_BASE_URL"]?.replace(/\/$/, "") ?? "/data";

export function dataUrl(path: string): string {
  return `${DATA_BASE}/${path.replace(/^\//, "")}`;
}

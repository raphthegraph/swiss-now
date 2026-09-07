export * from "./stac";
export * from "./decode";
export * from "./warp";

import { SWISS_NOW_USER_AGENT } from "../../geoadmin/client";
import { decodeOdimComposite, type RadarGrid } from "./decode";

/** Downloads and decodes one radar asset. Assets are immutable, so callers cache aggressively. */
export async function fetchRadarGrid(
  href: string,
  doFetch: typeof fetch = fetch,
): Promise<RadarGrid> {
  const res = await doFetch(href, { headers: { "User-Agent": SWISS_NOW_USER_AGENT } });
  if (!res.ok) throw new Error(`radar asset ${res.status}: ${href}`);
  return decodeOdimComposite(new Uint8Array(await res.arrayBuffer()));
}

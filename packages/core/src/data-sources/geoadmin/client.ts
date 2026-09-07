import { geoAdminLayerUrl, type GeoAdminLang, type GeoAdminMeasurementLayerId } from "./layers";
import { parseGeoAdminLayer, type GeoAdminFeatureCollection } from "./parse";

export const SWISS_NOW_USER_AGENT = "SwissNow/0.0.1 (+https://github.com/raphthegraph/swiss-now)";

export interface FetchOptions {
  /** Injected so Next.js can pass a `fetch` carrying `next: { revalidate }`. Defaults to global fetch. */
  fetch?: typeof fetch;
  lang?: GeoAdminLang;
  init?: RequestInit;
}

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly url: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function fetchGeoAdminLayer(
  layerId: GeoAdminMeasurementLayerId,
  opts: FetchOptions = {},
): Promise<GeoAdminFeatureCollection> {
  const url = geoAdminLayerUrl(layerId, opts.lang ?? "en");
  const doFetch = opts.fetch ?? fetch;
  const res = await doFetch(url, {
    ...opts.init,
    headers: {
      "User-Agent": SWISS_NOW_USER_AGENT,
      Accept: "application/json",
      ...opts.init?.headers,
    },
  });
  if (!res.ok)
    throw new UpstreamError(`geo.admin ${layerId} responded ${res.status}`, url, res.status);
  return parseGeoAdminLayer(await res.json());
}

import { listSources } from "@swiss-now/core";

/** GET /api/meta/sources → attribution, licences and cadences for every source (credits panel, end cards). */
export async function GET() {
  return Response.json(
    { generatedAt: new Date().toISOString(), sources: listSources() },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}

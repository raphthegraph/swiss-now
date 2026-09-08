import { getTodayStory } from "@/lib/story";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/story/today → StorySpec built from today's snapshots (also consumed by Remotion later). */
export async function GET() {
  const story = await getTodayStory();
  return Response.json(story, {
    headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
  });
}

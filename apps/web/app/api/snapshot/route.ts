import { maybeWriteSnapshot } from "@/lib/snapshots/writer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/snapshot → writes the current 10-minute snapshot if missing. Never cached. */
export async function POST() {
  try {
    const result = await maybeWriteSnapshot();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { written: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

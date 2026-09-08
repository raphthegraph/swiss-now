import { SNAPSHOT_RETENTION_HOURS, snapshotStore } from "@/lib/snapshots/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/snapshots → the last 48 h of snapshots (oldest first) for the timeline. */
export async function GET() {
  const since = Date.now() - SNAPSHOT_RETENTION_HOURS * 3_600_000;
  const snapshots = await snapshotStore().list(since);
  return Response.json(
    { retentionHours: SNAPSHOT_RETENTION_HOURS, snapshots },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}

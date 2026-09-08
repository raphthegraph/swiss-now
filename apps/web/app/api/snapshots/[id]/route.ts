import { snapshotStore } from "@/lib/snapshots/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/snapshots/{id} → one stored snapshot (immutable once written). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clean = id.replace(/\.json$/, "");
  const snap = await snapshotStore().read(clean);
  if (!snap) return new Response("unknown snapshot", { status: 404 });
  return new Response(JSON.stringify(snap), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable",
    },
  });
}

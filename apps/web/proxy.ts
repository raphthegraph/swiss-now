import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, expectedToken, gateEnabled } from "@/lib/gate";

/**
 * The password screen (docs/DEPLOYMENT.md): every page needs the access cookie on the deployed
 * site; API routes, static files and the enter page itself stay open so the app's own fetches, the
 * snapshot ping and the brand assets keep working.
 */
export async function proxy(request: NextRequest) {
  if (!gateEnabled()) return NextResponse.next();
  const token = request.cookies.get(GATE_COOKIE)?.value;
  if (token && token === (await expectedToken())) return NextResponse.next();
  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/enter";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!api/|_next/|brand/|geo/|data/|map/|rail/|snapshots/|enter|icon\\.png|apple-icon\\.png|favicon\\.ico).*)",
  ],
};

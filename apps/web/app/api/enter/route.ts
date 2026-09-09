import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, GATE_MAX_AGE, expectedToken, safeNext, tokenFor } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/enter (form: password, next) → sets the access cookie and returns to the page asked for. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));
  const ok = password.length > 0 && (await tokenFor(password)) === (await expectedToken());
  const url = request.nextUrl.clone();
  url.search = "";
  if (!ok) {
    url.pathname = "/enter";
    url.search = `?error=1${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`;
    return NextResponse.redirect(url, 303);
  }
  url.pathname = next.split("?")[0] ?? "/";
  url.search = next.includes("?") ? next.slice(next.indexOf("?")) : "";
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(GATE_COOKIE, await expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return res;
}

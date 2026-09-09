/**
 * The site password (a single shared password, no accounts). The password itself never lives in
 * the repository: production reads `SITE_PASSWORD`; when it is unset the SHA-256 below (the
 * launch password) applies. The cookie carries the same digest, so a wrong password can never
 * produce a valid cookie. Local development (no VERCEL, no SITE_PASSWORD) runs without a gate.
 */
const SALT = "|swiss-now-gate";
const LAUNCH_PASSWORD_SHA256 = "65f4fa18ac92a36d2e136a7a5842f6764183b4d6854161e9d238037900aae848";
export const GATE_COOKIE = "sn_access";
export const GATE_MAX_AGE = 60 * 60 * 24 * 30;

export function gateEnabled(): boolean {
  return Boolean(process.env["SITE_PASSWORD"] || process.env["VERCEL"]);
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The digest a valid cookie must carry. */
export async function expectedToken(): Promise<string> {
  const pw = process.env["SITE_PASSWORD"];
  return pw ? sha256Hex(pw + SALT) : LAUNCH_PASSWORD_SHA256;
}

export async function tokenFor(password: string): Promise<string> {
  return sha256Hex(password + SALT);
}

/** Only same-site paths may be the redirect target after entering. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

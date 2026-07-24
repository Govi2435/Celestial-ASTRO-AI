import { loadAccountPersistenceRuntime } from "../../../account-persistence-runtime.ts";
import { D1ServerSessionStore } from "../../../server-session-d1.ts";
import {
  clearServerSessionCookie,
  revokeServerSession,
} from "../../../server-session.ts";

export const dynamic = "force-dynamic";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function response(status: number, outcome: string) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("X-Celestial-Session", outcome);
  headers.append("Set-Cookie", clearServerSessionCookie());
  return new Response(null, { status, headers });
}

export async function POST(request: Request) {
  const runtime = await loadAccountPersistenceRuntime();
  if (runtime.appEnv !== "staging") return response(404, "not-found");
  if (!runtime.db) return response(503, "configuration-required");

  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return response(404, "not-found");
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return response(403, "origin-rejected");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    return response(403, "site-rejected");
  }

  try {
    await revokeServerSession(
      new D1ServerSessionStore(runtime.db),
      request.headers.get("cookie"),
      "logout",
    );
    return response(204, "revoked");
  } catch {
    return response(204, "cleared");
  }
}

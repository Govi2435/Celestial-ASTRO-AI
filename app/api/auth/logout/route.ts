import { D1AuthRateLimitStore } from "../../../auth-rate-limit-d1.ts";
import {
  AUTH_RATE_LIMITS,
  AuthRateLimitError,
  applyRateLimitErrorHeaders,
  enforceAuthRateLimit,
} from "../../../auth-rate-limit.ts";
import { loadAccountPersistenceRuntime } from "../../../account-persistence-runtime.ts";
import {
  RequestSecurityError,
  assertSessionCsrf,
} from "../../../request-security.ts";
import { D1ServerSessionStore } from "../../../server-session-d1.ts";
import {
  ServerSessionError,
  authenticateServerSession,
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

function response(status: number, outcome: string, error?: string, headers?: Headers) {
  const responseHeaders = headers ?? new Headers(COMMON_HEADERS);
  responseHeaders.set("X-Celestial-Session", outcome);
  if (error) responseHeaders.set("X-Celestial-Session-Error", error);
  if (status === 204 || status === 401) responseHeaders.append("Set-Cookie", clearServerSessionCookie());
  if (status === 204) return new Response(null, { status, headers: responseHeaders });
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return Response.json({ error: error ?? outcome }, { status, headers: responseHeaders });
}

export async function POST(request: Request) {
  const runtime = await loadAccountPersistenceRuntime();
  if (runtime.appEnv !== "staging") return response(404, "not-found");
  if (!runtime.db) return response(503, "configuration-required");

  const store = new D1ServerSessionStore(runtime.db);
  try {
    const authenticated = await authenticateServerSession(store, request.headers.get("cookie"));
    await assertSessionCsrf(request, store, authenticated.session.id);
    const rateLimit = await enforceAuthRateLimit(
      new D1AuthRateLimitStore(runtime.db),
      AUTH_RATE_LIMITS.logout,
      `${authenticated.account.id}:${authenticated.session.id}`,
    );
    await revokeServerSession(store, request.headers.get("cookie"), "logout");
    const headers = new Headers(COMMON_HEADERS);
    headers.set("RateLimit-Limit", String(rateLimit.limit));
    headers.set("RateLimit-Remaining", String(rateLimit.remaining));
    headers.set("RateLimit-Reset", String(rateLimit.resetSeconds));
    return response(204, "revoked", undefined, headers);
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return response(error.status, "security-rejected", error.code);
    }
    if (error instanceof AuthRateLimitError) {
      const headers = new Headers(COMMON_HEADERS);
      applyRateLimitErrorHeaders(headers, error);
      return response(error.status, "rate-limited", error.code, headers);
    }
    if (error instanceof ServerSessionError) {
      return response(error.status >= 500 ? 502 : error.status, "session-rejected", error.code);
    }
    console.warn("Logout request rejected", { code: "logout_unexpected", status: 500 });
    return response(502, "unexpected", "logout_unexpected");
  }
}

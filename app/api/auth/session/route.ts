import { loadAccountPersistenceRuntime } from "../../../account-persistence-runtime.ts";
import { D1ServerSessionStore } from "../../../server-session-d1.ts";
import {
  ServerSessionError,
  authenticateServerSession,
  clearServerSessionCookie,
} from "../../../server-session.ts";

export const dynamic = "force-dynamic";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function jsonResponse(body: unknown, status: number, headers?: Headers) {
  const responseHeaders = headers ?? new Headers(COMMON_HEADERS);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return Response.json(body, { status, headers: responseHeaders });
}

export async function GET(request: Request) {
  const runtime = await loadAccountPersistenceRuntime();
  if (runtime.appEnv !== "staging") {
    return jsonResponse({ error: "not_found" }, 404);
  }
  if (!runtime.db) {
    return jsonResponse({ error: "account_persistence_not_configured" }, 503);
  }

  try {
    const authenticated = await authenticateServerSession(
      new D1ServerSessionStore(runtime.db),
      request.headers.get("cookie"),
    );
    const headers = new Headers(COMMON_HEADERS);
    headers.set(
      "X-Celestial-Session",
      authenticated.rotated ? "rotated" : "authenticated",
    );
    if (authenticated.setCookie) {
      headers.append("Set-Cookie", authenticated.setCookie);
    }
    return jsonResponse(
      {
        authenticated: true,
        account: {
          id: authenticated.account.id,
          email: authenticated.account.email,
          displayName: authenticated.account.displayName,
        },
        session: {
          id: authenticated.session.id,
          authMethod: authenticated.session.authMethod,
          expiresAt: authenticated.session.expiresAt,
          absoluteExpiresAt: authenticated.session.absoluteExpiresAt,
          rotationCount: authenticated.session.rotationCount,
        },
      },
      200,
      headers,
    );
  } catch (error) {
    const diagnostic =
      error instanceof ServerSessionError
        ? { code: error.code, status: error.status }
        : { code: "session_validation_unexpected", status: 500 };
    console.warn("Server session validation rejected", {
      code: diagnostic.code,
      status: diagnostic.status,
    });
    const headers = new Headers(COMMON_HEADERS);
    headers.set("X-Celestial-Session", "rejected");
    headers.set("X-Celestial-Session-Error", diagnostic.code);
    headers.append("Set-Cookie", clearServerSessionCookie());
    return jsonResponse(
      { authenticated: false, error: diagnostic.code },
      diagnostic.status >= 500 ? 502 : diagnostic.status,
      headers,
    );
  }
}

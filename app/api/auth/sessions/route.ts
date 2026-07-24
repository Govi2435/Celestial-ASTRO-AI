import { D1AuthRateLimitStore } from "../../../auth-rate-limit-d1.ts";
import {
  AUTH_RATE_LIMITS,
  AuthRateLimitError,
  applyRateLimitErrorHeaders,
  applyRateLimitHeaders,
  enforceAuthRateLimit,
} from "../../../auth-rate-limit.ts";
import { loadAccountPersistenceRuntime } from "../../../account-persistence-runtime.ts";
import {
  RequestSecurityError,
  assertSessionCsrf,
  assertTrustedMutation,
  issueSessionCsrf,
} from "../../../request-security.ts";
import { D1ServerSessionStore } from "../../../server-session-d1.ts";
import {
  SessionManagementError,
  listManagedSessions,
  revokeManagedSession,
  revokeOtherManagedSessions,
} from "../../../session-management.ts";
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
  Vary: "Cookie",
} as const;

function jsonResponse(body: unknown, status: number, headers?: Headers) {
  const responseHeaders = headers ?? new Headers(COMMON_HEADERS);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return Response.json(body, { status, headers: responseHeaders });
}

function errorResponse(error: unknown) {
  if (error instanceof ServerSessionError) {
    const headers = new Headers(COMMON_HEADERS);
    headers.set("X-Celestial-Session", "rejected");
    headers.set("X-Celestial-Session-Error", error.code);
    headers.append("Set-Cookie", clearServerSessionCookie());
    return jsonResponse(
      { authenticated: false, error: error.code },
      error.status >= 500 ? 502 : error.status,
      headers,
    );
  }
  if (error instanceof RequestSecurityError) {
    return jsonResponse({ error: error.code }, error.status);
  }
  if (error instanceof AuthRateLimitError) {
    const headers = new Headers(COMMON_HEADERS);
    applyRateLimitErrorHeaders(headers, error);
    return jsonResponse({ error: error.code }, error.status, headers);
  }
  if (error instanceof SessionManagementError) {
    return jsonResponse({ error: error.code }, error.status);
  }
  console.warn("Session management request rejected", {
    code: "session_management_unexpected",
    status: 500,
  });
  return jsonResponse({ error: "session_management_unexpected" }, 502);
}

async function loadAuthenticated(request: Request) {
  const runtime = await loadAccountPersistenceRuntime();
  if (runtime.appEnv !== "staging") {
    return { response: jsonResponse({ error: "not_found" }, 404) } as const;
  }
  if (!runtime.db) {
    return {
      response: jsonResponse({ error: "account_persistence_not_configured" }, 503),
    } as const;
  }
  const store = new D1ServerSessionStore(runtime.db);
  const authenticated = await authenticateServerSession(
    store,
    request.headers.get("cookie"),
  );
  return {
    store,
    rateLimitStore: new D1AuthRateLimitStore(runtime.db),
    authenticated,
  } as const;
}

function authenticatedHeaders(
  setCookie: string | null,
  outcome: "listed" | "revoked" | "others-revoked",
  rateLimit?: { limit: number; remaining: number; resetSeconds: number },
) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("X-Celestial-Session-Management", outcome);
  if (setCookie) headers.append("Set-Cookie", setCookie);
  if (rateLimit) applyRateLimitHeaders(headers, rateLimit);
  return headers;
}

export async function GET(request: Request) {
  try {
    const loaded = await loadAuthenticated(request);
    if ("response" in loaded) return loaded.response;
    const [sessions, csrfToken] = await Promise.all([
      listManagedSessions(
        loaded.store,
        loaded.authenticated.account.id,
        loaded.authenticated.session.id,
      ),
      issueSessionCsrf(loaded.store, loaded.authenticated.session.id),
    ]);
    return jsonResponse(
      {
        authenticated: true,
        account: {
          id: loaded.authenticated.account.id,
          email: loaded.authenticated.account.email,
          displayName: loaded.authenticated.account.displayName,
        },
        sessions,
        csrfToken,
      },
      200,
      authenticatedHeaders(loaded.authenticated.setCookie, "listed"),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedMutation(request);
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      return jsonResponse({ error: "session_management_content_type_invalid" }, 415);
    }

    const loaded = await loadAuthenticated(request);
    if ("response" in loaded) return loaded.response;
    await assertSessionCsrf(request, loaded.store, loaded.authenticated.session.id);
    const rateLimit = await enforceAuthRateLimit(
      loaded.rateLimitStore,
      AUTH_RATE_LIMITS.sessionMutation,
      loaded.authenticated.account.id,
    );
    const body = (await request.json()) as {
      action?: unknown;
      sessionId?: unknown;
    };

    if (body.action === "revoke-session") {
      const result = await revokeManagedSession(loaded.store, {
        accountId: loaded.authenticated.account.id,
        currentSessionId: loaded.authenticated.session.id,
        targetSessionId: body.sessionId,
      });
      const [sessions, csrfToken] = await Promise.all([
        listManagedSessions(
          loaded.store,
          loaded.authenticated.account.id,
          loaded.authenticated.session.id,
        ),
        issueSessionCsrf(loaded.store, loaded.authenticated.session.id),
      ]);
      return jsonResponse(
        { ...result, sessions, csrfToken },
        200,
        authenticatedHeaders(loaded.authenticated.setCookie, "revoked", rateLimit),
      );
    }

    if (body.action === "revoke-others") {
      const result = await revokeOtherManagedSessions(loaded.store, {
        accountId: loaded.authenticated.account.id,
        currentSessionId: loaded.authenticated.session.id,
      });
      const [sessions, csrfToken] = await Promise.all([
        listManagedSessions(
          loaded.store,
          loaded.authenticated.account.id,
          loaded.authenticated.session.id,
        ),
        issueSessionCsrf(loaded.store, loaded.authenticated.session.id),
      ]);
      return jsonResponse(
        { ...result, sessions, csrfToken },
        200,
        authenticatedHeaders(loaded.authenticated.setCookie, "others-revoked", rateLimit),
      );
    }

    return jsonResponse({ error: "session_management_action_invalid" }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}

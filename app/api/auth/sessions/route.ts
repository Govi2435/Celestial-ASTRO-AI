import { loadAccountPersistenceRuntime } from "../../../account-persistence-runtime.ts";
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

function mutationAllowed(request: Request) {
  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  return !fetchSite || ["same-origin", "none"].includes(fetchSite);
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
  return { store, authenticated } as const;
}

function authenticatedHeaders(
  setCookie: string | null,
  outcome: "listed" | "revoked" | "others-revoked",
) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("X-Celestial-Session-Management", outcome);
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return headers;
}

export async function GET(request: Request) {
  try {
    const loaded = await loadAuthenticated(request);
    if ("response" in loaded) return loaded.response;
    const sessions = await listManagedSessions(
      loaded.store,
      loaded.authenticated.account.id,
      loaded.authenticated.session.id,
    );
    return jsonResponse(
      {
        authenticated: true,
        account: {
          id: loaded.authenticated.account.id,
          email: loaded.authenticated.account.email,
          displayName: loaded.authenticated.account.displayName,
        },
        sessions,
      },
      200,
      authenticatedHeaders(loaded.authenticated.setCookie, "listed"),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!mutationAllowed(request)) {
    return jsonResponse({ error: "session_management_origin_rejected" }, 403);
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return jsonResponse({ error: "session_management_content_type_invalid" }, 415);
  }

  try {
    const loaded = await loadAuthenticated(request);
    if ("response" in loaded) return loaded.response;
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
      const sessions = await listManagedSessions(
        loaded.store,
        loaded.authenticated.account.id,
        loaded.authenticated.session.id,
      );
      return jsonResponse(
        { ...result, sessions },
        200,
        authenticatedHeaders(loaded.authenticated.setCookie, "revoked"),
      );
    }

    if (body.action === "revoke-others") {
      const result = await revokeOtherManagedSessions(loaded.store, {
        accountId: loaded.authenticated.account.id,
        currentSessionId: loaded.authenticated.session.id,
      });
      const sessions = await listManagedSessions(
        loaded.store,
        loaded.authenticated.account.id,
        loaded.authenticated.session.id,
      );
      return jsonResponse(
        { ...result, sessions },
        200,
        authenticatedHeaders(loaded.authenticated.setCookie, "others-revoked"),
      );
    }

    return jsonResponse({ error: "session_management_action_invalid" }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}

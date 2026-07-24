import { createGoogleAuthorizationRequest } from "../../../../google-oauth.ts";
import { loadGoogleOAuthRuntime } from "../../../../google-oauth-runtime.ts";

export const dynamic = "force-dynamic";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function notFound() {
  return Response.json({ error: "not_found" }, { status: 404, headers: COMMON_HEADERS });
}

function notConfigured() {
  return Response.json(
    {
      error: "google_oauth_not_configured",
      message: "Google sign-in is not configured for this environment.",
    },
    {
      status: 503,
      headers: {
        ...COMMON_HEADERS,
        "Retry-After": "3600",
        "X-Celestial-Google-OAuth": "configuration-required",
      },
    },
  );
}

export async function GET(request: Request) {
  const runtime = await loadGoogleOAuthRuntime();
  if (runtime.appEnv !== "staging") return notFound();
  if (!runtime.config) return notConfigured();

  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return notFound();
  const redirectUri = new URL("/api/auth/google/callback", requestUrl.origin).toString();

  try {
    const authorization = await createGoogleAuthorizationRequest(
      runtime.config,
      redirectUri,
      requestUrl.searchParams.get("returnTo"),
    );
    const headers = new Headers(COMMON_HEADERS);
    headers.set("Location", authorization.authorizationUrl);
    headers.append("Set-Cookie", authorization.cookie);
    headers.set("X-Celestial-Google-OAuth", "authorization-started");
    return new Response(null, { status: 302, headers });
  } catch {
    return Response.json(
      { error: "google_oauth_start_failed" },
      { status: 500, headers: COMMON_HEADERS },
    );
  }
}

import { D1AuthRateLimitStore } from "../../../../auth-rate-limit-d1.ts";
import {
  AUTH_RATE_LIMITS,
  AuthRateLimitError,
  applyRateLimitErrorHeaders,
  applyRateLimitHeaders,
  enforceAuthRateLimit,
} from "../../../../auth-rate-limit.ts";
import { loadAccountPersistenceRuntime } from "../../../../account-persistence-runtime.ts";
import { createGoogleAuthorizationRequest } from "../../../../google-oauth.ts";
import { loadGoogleOAuthRuntime } from "../../../../google-oauth-runtime.ts";
import { clientAddressKey } from "../../../../request-security.ts";

export const dynamic = "force-dynamic";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function notFound() {
  return Response.json({ error: "not_found" }, { status: 404, headers: COMMON_HEADERS });
}

function notConfigured(error: string, message: string) {
  return Response.json(
    { error, message },
    {
      status: 503,
      headers: {
        ...COMMON_HEADERS,
        "Retry-After": "3600",
        "X-Celestial-Google-OAuth": "configuration-required",
        "X-Celestial-Account-Persistence":
          error === "account_persistence_not_configured" ? "configuration-required" : "provider-ready",
      },
    },
  );
}

function authorizationCheckpoint(
  cookie: string,
  rateLimit: { limit: number; remaining: number; resetSeconds: number },
) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.append("Set-Cookie", cookie);
  headers.set("X-Celestial-Google-OAuth", "cookie-checkpoint");
  headers.set("X-Celestial-Account-Persistence", "ready");
  applyRateLimitHeaders(headers, rateLimit);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Continue with Google</title>
  <style>body{font-family:system-ui,sans-serif;max-width:38rem;margin:4rem auto;padding:0 1.25rem;line-height:1.6;color:#171717}main{border:1px solid #d4d4d4;border-radius:1rem;padding:1.5rem}h1{font-size:1.4rem;margin-top:0}a{display:inline-block;margin-top:.5rem;padding:.75rem 1rem;border-radius:.65rem;background:#171717;color:#fff;text-decoration:none;font-weight:700}.note{color:#525252}</style>
</head>
<body>
  <main>
    <h1>Continue with Google</h1>
    <p>Your secure sign-in transaction has been saved in this browser.</p>
    <p><a href="/api/auth/google/continue">Continue with Google</a></p>
    <p class="note">OAuth state, nonce and PKCE protect the provider callback. Start requests are throttled against automated abuse.</p>
  </main>
</body>
</html>`;

  return new Response(html, { status: 200, headers });
}

function rateLimited(error: AuthRateLimitError) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("X-Celestial-Google-OAuth", "rate-limited");
  applyRateLimitErrorHeaders(headers, error);
  return Response.json(
    { error: error.code, message: "Too many Google sign-in requests. Try again later." },
    { status: error.status, headers },
  );
}

export async function GET(request: Request) {
  const [runtime, persistence] = await Promise.all([
    loadGoogleOAuthRuntime(),
    loadAccountPersistenceRuntime(),
  ]);
  if (runtime.appEnv !== "staging" || persistence.appEnv !== "staging") return notFound();
  if (!runtime.config) {
    return notConfigured(
      "google_oauth_not_configured",
      "Google sign-in is not configured for this environment.",
    );
  }
  if (!persistence.db) {
    return notConfigured(
      "account_persistence_not_configured",
      "Account persistence is not configured for this environment.",
    );
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return notFound();
  const redirectUri = new URL("/api/auth/google/callback", requestUrl.origin).toString();

  try {
    const rateLimit = await enforceAuthRateLimit(
      new D1AuthRateLimitStore(persistence.db),
      AUTH_RATE_LIMITS.googleStart,
      clientAddressKey(request),
    );
    const authorization = await createGoogleAuthorizationRequest(
      runtime.config,
      redirectUri,
      requestUrl.searchParams.get("returnTo"),
    );
    return authorizationCheckpoint(authorization.cookie, rateLimit);
  } catch (error) {
    if (error instanceof AuthRateLimitError) return rateLimited(error);
    console.warn("Google OAuth start rejected", { code: "google_oauth_start_failed" });
    return Response.json(
      { error: "google_oauth_start_failed" },
      { status: 500, headers: COMMON_HEADERS },
    );
  }
}

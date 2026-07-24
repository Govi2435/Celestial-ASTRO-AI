import { createGoogleAuthorizationRequest } from "../../../../google-oauth.ts";
import { loadGoogleOAuthRuntime } from "../../../../google-oauth-runtime.ts";

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

function authorizationCheckpoint(cookie: string) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.append("Set-Cookie", cookie);
  headers.set("X-Celestial-Google-OAuth", "cookie-checkpoint");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Continue with Google</title>
  <style>body{font-family:system-ui,sans-serif;max-width:38rem;margin:4rem auto;padding:0 1.25rem;line-height:1.6;color:#171717}main{border:1px solid #d4d4d4;border-radius:1rem;padding:1.5rem}h1{font-size:1.4rem;margin-top:0}a{display:inline-block;margin-top:.5rem;padding:.75rem 1rem;border-radius:.65rem;background:#171717;color:#fff;text-decoration:none;font-weight:700}</style>
</head>
<body>
  <main>
    <h1>Continue with Google</h1>
    <p>Your secure sign-in transaction has been saved in this browser.</p>
    <p><a href="/api/auth/google/continue">Continue with Google</a></p>
  </main>
</body>
</html>`;

  return new Response(html, { status: 200, headers });
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
    return authorizationCheckpoint(authorization.cookie);
  } catch {
    return Response.json(
      { error: "google_oauth_start_failed" },
      { status: 500, headers: COMMON_HEADERS },
    );
  }
}

import { sha256Base64Url } from "../../../../auth-compatibility.ts";
import {
  GOOGLE_OAUTH_PROFILE,
  GoogleOAuthError,
  parseGoogleOAuthCookie,
  verifyGoogleOAuthTransaction,
} from "../../../../google-oauth.ts";
import { getGoogleOAuthDiagnostic } from "../../../../google-oauth-diagnostics.ts";
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

function failure(code: string, status = 400) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Celestial-Google-OAuth", "checkpoint-failed");
  headers.set("X-Celestial-Google-OAuth-Error", code);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Restart Google sign-in</title>
  <style>body{font-family:system-ui,sans-serif;max-width:38rem;margin:4rem auto;padding:0 1.25rem;line-height:1.6;color:#171717}main{border:1px solid #d4d4d4;border-radius:1rem;padding:1.5rem}h1{font-size:1.4rem;margin-top:0}a{font-weight:700}</style>
</head>
<body>
  <main>
    <h1>Restart Google sign-in</h1>
    <p>The secure browser checkpoint was not available.</p>
    <p>Diagnostic code: <code>${code}</code></p>
    <p><a href="/api/auth/google/start">Start a new sign-in attempt</a></p>
  </main>
</body>
</html>`;

  return new Response(html, { status, headers });
}

export async function GET(request: Request) {
  const runtime = await loadGoogleOAuthRuntime();
  if (runtime.appEnv !== "staging") return notFound();
  if (!runtime.config) return failure("google_oauth_not_configured", 503);

  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return notFound();

  try {
    const cookieValue = parseGoogleOAuthCookie(request.headers.get("cookie"));
    if (!cookieValue) throw new GoogleOAuthError("oauth_transaction_missing_at_checkpoint");

    const transaction = await verifyGoogleOAuthTransaction(
      cookieValue,
      runtime.config.cookieSecret,
    );
    const redirectUri = new URL("/api/auth/google/callback", requestUrl.origin).toString();
    const authorizationUrl = new URL(GOOGLE_OAUTH_PROFILE.authorizationEndpoint);
    authorizationUrl.searchParams.set("client_id", runtime.config.clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("scope", GOOGLE_OAUTH_PROFILE.scopes.join(" "));
    authorizationUrl.searchParams.set("state", transaction.state);
    authorizationUrl.searchParams.set("nonce", transaction.nonce);
    authorizationUrl.searchParams.set(
      "code_challenge",
      await sha256Base64Url(transaction.codeVerifier),
    );
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    authorizationUrl.searchParams.set("access_type", "online");
    authorizationUrl.searchParams.set("prompt", "select_account");

    const headers = new Headers(COMMON_HEADERS);
    headers.set("Location", authorizationUrl.toString());
    headers.set("X-Celestial-Google-OAuth", "checkpoint-passed");
    return new Response(null, { status: 302, headers });
  } catch (error) {
    const diagnostic = getGoogleOAuthDiagnostic(error);
    return failure(diagnostic.code, diagnostic.status >= 500 ? 502 : 400);
  }
}

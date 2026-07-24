import {
  GOOGLE_OAUTH_PROFILE,
  GoogleOAuthError,
  clearGoogleOAuthCookie,
  parseGoogleOAuthCookie,
  verifyGoogleIdToken,
  verifyGoogleOAuthTransaction,
} from "../../../../google-oauth.ts";
import { exchangeGoogleAuthorizationCodeAtEdge } from "../../../../google-oauth-token-exchange.ts";
import { getGoogleOAuthDiagnostic } from "../../../../google-oauth-diagnostics.ts";
import { loadGoogleOAuthRuntime } from "../../../../google-oauth-runtime.ts";

export const dynamic = "force-dynamic";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

type CallbackStage =
  | "transaction_cookie"
  | "transaction_verification"
  | "state_validation"
  | "token_exchange"
  | "id_token_verification"
  | "identity_validation";

function notFound() {
  return Response.json({ error: "not_found" }, { status: 404, headers: COMMON_HEADERS });
}

function htmlResponse(
  status: number,
  title: string,
  message: string,
  outcome: string,
  diagnosticCode?: string,
) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Celestial-Google-OAuth", outcome);
  if (diagnosticCode) {
    headers.set("X-Celestial-Google-OAuth-Error", diagnosticCode);
  }
  headers.append("Set-Cookie", clearGoogleOAuthCookie());
  const diagnostic = diagnosticCode
    ? `<p class="diagnostic">Diagnostic code: <code>${diagnosticCode}</code></p>`
    : "";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1.25rem;line-height:1.6;color:#171717}main{border:1px solid #d4d4d4;border-radius:1rem;padding:1.5rem}h1{font-size:1.5rem;margin-top:0}.note{color:#525252}.diagnostic{margin-top:1rem;padding:.75rem;border-radius:.5rem;background:#f5f5f5;color:#404040}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}</style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    ${diagnostic}
    <p class="note">This staging flow does not create a Celestial account or authenticated session yet.</p>
  </main>
</body>
</html>`;
  return new Response(html, { status, headers });
}

function safeDiagnostic(error: unknown, stage: CallbackStage) {
  if (error instanceof GoogleOAuthError) return getGoogleOAuthDiagnostic(error);
  return {
    code: `google_callback_${stage}_unexpected`,
    status: 500,
  };
}

export async function GET(request: Request) {
  const runtime = await loadGoogleOAuthRuntime();
  if (runtime.appEnv !== "staging") return notFound();
  if (!runtime.config) {
    return htmlResponse(
      503,
      "Google sign-in unavailable",
      "Google sign-in is not configured for this environment.",
      "configuration-required",
      "google_oauth_not_configured",
    );
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return notFound();
  const redirectUri = new URL("/api/auth/google/callback", requestUrl.origin).toString();
  const providerError = requestUrl.searchParams.get("error");
  if (providerError) {
    return htmlResponse(
      400,
      "Google sign-in cancelled",
      "Google did not complete the authorization request.",
      "provider-declined",
      "google_provider_declined",
    );
  }

  let stage: CallbackStage = "transaction_cookie";

  try {
    const cookieValue = parseGoogleOAuthCookie(request.headers.get("cookie"));
    if (!cookieValue) throw new GoogleOAuthError("oauth_transaction_missing");

    stage = "transaction_verification";
    const transaction = await verifyGoogleOAuthTransaction(
      cookieValue,
      runtime.config.cookieSecret,
    );

    stage = "state_validation";
    const returnedState = requestUrl.searchParams.get("state");
    if (!returnedState || returnedState !== transaction.state) {
      throw new GoogleOAuthError("oauth_state_mismatch");
    }

    stage = "token_exchange";
    const code = requestUrl.searchParams.get("code");
    const tokens = await exchangeGoogleAuthorizationCodeAtEdge(
      runtime.config,
      code,
      transaction.codeVerifier,
      redirectUri,
    );

    stage = "id_token_verification";
    const identity = await verifyGoogleIdToken(tokens.idToken, {
      clientId: runtime.config.clientId,
      nonce: transaction.nonce,
    });

    stage = "identity_validation";
    if (identity.provider !== "google" || !identity.emailVerified) {
      throw new GoogleOAuthError("google_identity_invalid");
    }

    return htmlResponse(
      200,
      "Google identity verified",
      `The ${GOOGLE_OAUTH_PROFILE.id} provider flow completed successfully.`,
      "identity-verified",
    );
  } catch (error) {
    const diagnostic = safeDiagnostic(error, stage);
    console.warn("Google OAuth callback rejected", {
      code: diagnostic.code,
      status: diagnostic.status,
      stage,
    });
    const safeStatus = diagnostic.status >= 500 ? 502 : 400;
    return htmlResponse(
      safeStatus,
      "Google sign-in could not be verified",
      "The authorization response was rejected. Start a new sign-in attempt.",
      "verification-failed",
      diagnostic.code,
    );
  }
}

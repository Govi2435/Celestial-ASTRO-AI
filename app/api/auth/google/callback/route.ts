import { D1AccountIdentityStore } from "../../../../account-identity-d1.ts";
import {
  AccountPersistenceError,
  persistVerifiedIdentity,
} from "../../../../account-identity-persistence.ts";
import { loadAccountPersistenceRuntime } from "../../../../account-persistence-runtime.ts";
import {
  GOOGLE_OAUTH_PROFILE,
  GoogleOAuthError,
  clearGoogleOAuthCookie,
  parseGoogleOAuthCookie,
  verifyGoogleOAuthTransaction,
} from "../../../../google-oauth.ts";
import { verifyGoogleIdTokenAtEdge } from "../../../../google-id-token-verifier.ts";
import { exchangeGoogleAuthorizationCodeAtEdge } from "../../../../google-oauth-token-exchange.ts";
import { getGoogleOAuthDiagnostic } from "../../../../google-oauth-diagnostics.ts";
import { loadGoogleOAuthRuntime } from "../../../../google-oauth-runtime.ts";
import { D1ServerSessionStore } from "../../../../server-session-d1.ts";
import {
  ServerSessionError,
  createServerSession,
} from "../../../../server-session.ts";

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
  | "identity_validation"
  | "account_persistence"
  | "session_creation";

function notFound() {
  return Response.json({ error: "not_found" }, { status: 404, headers: COMMON_HEADERS });
}

function htmlResponse(
  status: number,
  title: string,
  message: string,
  outcome: string,
  diagnosticCode?: string,
  persistenceOutcome?: string,
  sessionCookie?: string,
  sessionOutcome?: string,
) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Celestial-Google-OAuth", outcome);
  if (diagnosticCode) headers.set("X-Celestial-Google-OAuth-Error", diagnosticCode);
  if (persistenceOutcome) headers.set("X-Celestial-Account-Persistence", persistenceOutcome);
  if (sessionOutcome) headers.set("X-Celestial-Session", sessionOutcome);
  headers.append("Set-Cookie", clearGoogleOAuthCookie());
  if (sessionCookie) headers.append("Set-Cookie", sessionCookie);
  const diagnostic = diagnosticCode
    ? `<p class="diagnostic">Diagnostic code: <code>${diagnosticCode}</code></p>`
    : "";
  const note = sessionCookie
    ? "The secure server session is active. Session-management UI follows in ASTRO-126."
    : "The account and Google identity are durable, but no authenticated session was issued.";
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
    <p class="note">${note}</p>
  </main>
</body>
</html>`;
  return new Response(html, { status, headers });
}

function safeDiagnostic(error: unknown, stage: CallbackStage) {
  if (error instanceof GoogleOAuthError) return getGoogleOAuthDiagnostic(error);
  if (error instanceof AccountPersistenceError || error instanceof ServerSessionError) {
    return { code: error.code, status: error.status };
  }
  return { code: `google_callback_${stage}_unexpected`, status: 500 };
}

export async function GET(request: Request) {
  const [runtime, persistence] = await Promise.all([
    loadGoogleOAuthRuntime(),
    loadAccountPersistenceRuntime(),
  ]);
  if (runtime.appEnv !== "staging" || persistence.appEnv !== "staging") return notFound();
  if (!runtime.config) {
    return htmlResponse(
      503,
      "Google sign-in unavailable",
      "Google sign-in is not configured for this environment.",
      "configuration-required",
      "google_oauth_not_configured",
    );
  }
  if (!persistence.db) {
    return htmlResponse(
      503,
      "Account persistence unavailable",
      "The staging database binding is not configured.",
      "configuration-required",
      "account_persistence_not_configured",
      "configuration-required",
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
    const transaction = await verifyGoogleOAuthTransaction(cookieValue, runtime.config.cookieSecret);

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
    const identity = await verifyGoogleIdTokenAtEdge(tokens.idToken, {
      clientId: runtime.config.clientId,
      nonce: transaction.nonce,
    });

    stage = "identity_validation";
    if (identity.provider !== "google" || !identity.emailVerified) {
      throw new GoogleOAuthError("google_identity_invalid");
    }

    stage = "account_persistence";
    const accountStore = new D1AccountIdentityStore(persistence.db);
    const persisted = await persistVerifiedIdentity(accountStore, {
      provider: "google",
      subject: identity.subject,
      email: identity.email,
      emailVerified: true,
      displayName: identity.displayName,
      pictureUrl: identity.pictureUrl,
    });

    stage = "session_creation";
    const authenticated = await createServerSession(
      new D1ServerSessionStore(persistence.db),
      {
        accountId: persisted.accountId,
        identityId: persisted.identityId,
        authMethod: "google",
      },
    );

    return htmlResponse(
      200,
      "Google authenticated session created",
      `The ${GOOGLE_OAUTH_PROFILE.id} flow completed, the verified identity was stored, and a secure server session was issued.`,
      "session-created",
      undefined,
      persisted.outcome,
      authenticated.setCookie,
      "created",
    );
  } catch (error) {
    const diagnostic = safeDiagnostic(error, stage);
    console.warn("Google OAuth callback rejected", {
      code: diagnostic.code,
      status: diagnostic.status,
      stage,
    });
    return htmlResponse(
      diagnostic.status >= 500 ? 502 : diagnostic.status,
      "Google sign-in could not be completed",
      "The authorization, account persistence, or session creation step was rejected. Start a new sign-in attempt.",
      "verification-failed",
      diagnostic.code,
      "failed",
      undefined,
      "failed",
    );
  }
}

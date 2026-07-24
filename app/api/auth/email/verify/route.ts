import { D1AccountIdentityStore } from "../../../../account-identity-d1.ts";
import {
  AccountPersistenceError,
  assertDurableMagicLinkConsumable,
  consumeDurableMagicLink,
  persistVerifiedIdentity,
} from "../../../../account-identity-persistence.ts";
import { loadAccountPersistenceRuntime } from "../../../../account-persistence-runtime.ts";
import { verifyDurableEmailMagicLink } from "../../../../durable-email-magic-link.ts";
import {
  EMAIL_MAGIC_LINK_PROFILE,
  EmailMagicLinkError,
  clearEmailMagicCookie,
} from "../../../../email-magic-link.ts";
import { loadEmailMagicLinkRuntime } from "../../../../email-magic-link-runtime.ts";
import { D1ServerSessionStore } from "../../../../server-session-d1.ts";
import {
  ServerSessionError,
  createServerSession,
} from "../../../../server-session.ts";

export const dynamic = "force-dynamic";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

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
  headers.set("X-Celestial-Email-Magic", outcome);
  if (diagnosticCode) headers.set("X-Celestial-Email-Magic-Error", diagnosticCode);
  if (persistenceOutcome) headers.set("X-Celestial-Account-Persistence", persistenceOutcome);
  if (sessionOutcome) headers.set("X-Celestial-Session", sessionOutcome);
  headers.append("Set-Cookie", clearEmailMagicCookie());
  if (sessionCookie) headers.append("Set-Cookie", sessionCookie);
  const diagnostic = diagnosticCode
    ? `<p class="diagnostic">Diagnostic code: <code>${diagnosticCode}</code></p>`
    : "";
  const note = sessionCookie
    ? "The secure server session is active. Session-management UI follows in ASTRO-126."
    : "The account and email identity are durable, but no authenticated session was issued.";
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

function notConfigured(code: string, message: string) {
  return htmlResponse(
    503,
    "Email sign-in unavailable",
    message,
    "configuration-required",
    code,
    code === "account_persistence_not_configured" ? "configuration-required" : undefined,
  );
}

export async function GET(request: Request) {
  const [runtime, persistence] = await Promise.all([
    loadEmailMagicLinkRuntime(),
    loadAccountPersistenceRuntime(),
  ]);
  if (runtime.appEnv !== "staging" || persistence.appEnv !== "staging") return notFound();
  if (!runtime.config) {
    return notConfigured(
      "email_magic_link_not_configured",
      "Email magic-link sign-in is not configured for this environment.",
    );
  }
  if (!persistence.db) {
    return notConfigured(
      "account_persistence_not_configured",
      "The staging database binding is not configured.",
    );
  }
  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return notFound();

  try {
    const verification = await verifyDurableEmailMagicLink(
      requestUrl.searchParams.get("token"),
      runtime.config.secret,
    );
    const accountStore = new D1AccountIdentityStore(persistence.db);
    await assertDurableMagicLinkConsumable(accountStore, verification);
    const persisted = await persistVerifiedIdentity(accountStore, {
      provider: "email_magic_link",
      subject: verification.email,
      email: verification.email,
      emailVerified: true,
    });
    await consumeDurableMagicLink(accountStore, verification.fingerprint);
    const authenticated = await createServerSession(
      new D1ServerSessionStore(persistence.db),
      {
        accountId: persisted.accountId,
        identityId: persisted.identityId,
        authMethod: "email_magic_link",
      },
    );

    return htmlResponse(
      200,
      "Email authenticated session created",
      `The ${EMAIL_MAGIC_LINK_PROFILE.id} flow completed, the verified identity was stored, and a secure server session was issued.`,
      "session-created",
      undefined,
      persisted.outcome,
      authenticated.setCookie,
      "created",
    );
  } catch (error) {
    const diagnostic =
      error instanceof EmailMagicLinkError ||
      error instanceof AccountPersistenceError ||
      error instanceof ServerSessionError
        ? { code: error.code, status: error.status }
        : { code: "email_magic_verify_unexpected", status: 500 };
    console.warn("Email magic-link verification rejected", {
      code: diagnostic.code,
      status: diagnostic.status,
    });
    return htmlResponse(
      diagnostic.status >= 500 ? 502 : diagnostic.status,
      "Email sign-in could not be completed",
      "The sign-in link, account persistence, or session creation step was rejected. Request a new link.",
      "verification-failed",
      diagnostic.code,
      "failed",
      undefined,
      "failed",
    );
  }
}

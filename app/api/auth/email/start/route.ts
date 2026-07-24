import { D1AccountIdentityStore } from "../../../../account-identity-d1.ts";
import {
  AccountPersistenceError,
  registerDurableMagicLink,
  revokeDurableMagicLink,
} from "../../../../account-identity-persistence.ts";
import { loadAccountPersistenceRuntime } from "../../../../account-persistence-runtime.ts";
import { D1AuthRateLimitStore } from "../../../../auth-rate-limit-d1.ts";
import {
  AUTH_RATE_LIMITS,
  AuthRateLimitError,
  applyRateLimitErrorHeaders,
  applyRateLimitHeaders,
  enforceAuthRateLimit,
} from "../../../../auth-rate-limit.ts";
import { sanitizeReturnTo } from "../../../../auth-compatibility.ts";
import { sendEmailMagicLink } from "../../../../email-magic-link-delivery.ts";
import {
  EmailMagicLinkError,
  createEmailMagicLink,
} from "../../../../email-magic-link.ts";
import { loadEmailMagicLinkRuntime } from "../../../../email-magic-link-runtime.ts";
import {
  REQUEST_SECURITY_PROFILE,
  RequestSecurityError,
  assertAnonymousCsrf,
  clearAnonymousCsrfCookie,
  clientAddressKey,
  createAnonymousCsrfToken,
  serializeAnonymousCsrfCookie,
} from "../../../../request-security.ts";

export const dynamic = "force-dynamic";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
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
        "X-Celestial-Email-Magic": "configuration-required",
        "X-Celestial-Account-Persistence":
          error === "account_persistence_not_configured" ? "configuration-required" : "provider-ready",
      },
    },
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function requestForm(returnTo: string, csrfToken: string) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Celestial-Email-Magic", "request-ready");
  headers.set("X-Celestial-Account-Persistence", "ready");
  headers.set("X-Celestial-CSRF", "issued");
  headers.append("Set-Cookie", serializeAnonymousCsrfCookie(csrfToken));
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sign in by email</title>
  <style>body{font-family:system-ui,sans-serif;max-width:38rem;margin:4rem auto;padding:0 1.25rem;line-height:1.6;color:#171717}main{border:1px solid #d4d4d4;border-radius:1rem;padding:1.5rem}h1{font-size:1.45rem;margin-top:0}label{display:block;font-weight:700;margin-bottom:.35rem}input{box-sizing:border-box;width:100%;padding:.75rem;border:1px solid #a3a3a3;border-radius:.55rem;font:inherit}button{margin-top:1rem;padding:.75rem 1rem;border:0;border-radius:.65rem;background:#171717;color:#fff;font:inherit;font-weight:700;cursor:pointer}.note{color:#525252;font-size:.95rem}</style>
</head>
<body>
  <main>
    <h1>Sign in by email</h1>
    <form method="post" action="/api/auth/email/start">
      <label for="email">Email address</label>
      <input id="email" name="email" type="email" inputmode="email" autocomplete="email" maxlength="320" required>
      <input name="returnTo" type="hidden" value="${escapeHtml(returnTo)}">
      <input name="${REQUEST_SECURITY_PROFILE.anonymousCsrfFieldName}" type="hidden" value="${csrfToken}">
      <button type="submit">Send secure sign-in link</button>
    </form>
    <p class="note">The link expires in 10 minutes and may be opened in any browser. Requests are protected against cross-site submission and automated abuse.</p>
  </main>
</body>
</html>`;
  return new Response(html, { status: 200, headers });
}

function sentResponse(
  cookie: string,
  rateLimit: { limit: number; remaining: number; resetSeconds: number },
) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Celestial-Email-Magic", "link-sent");
  headers.set("X-Celestial-Account-Persistence", "token-registered");
  headers.append("Set-Cookie", cookie);
  headers.append("Set-Cookie", clearAnonymousCsrfCookie());
  applyRateLimitHeaders(headers, rateLimit);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Check your email</title>
  <style>body{font-family:system-ui,sans-serif;max-width:38rem;margin:4rem auto;padding:0 1.25rem;line-height:1.6;color:#171717}main{border:1px solid #d4d4d4;border-radius:1rem;padding:1.5rem}h1{font-size:1.45rem;margin-top:0}.note{color:#525252}</style>
</head>
<body>
  <main>
    <h1>Check your email</h1>
    <p>A secure sign-in link was requested. Open it within 10 minutes.</p>
    <p class="note">This response does not confirm whether an account exists. The link can be consumed only once.</p>
  </main>
</body>
</html>`;
  return new Response(html, { status: 202, headers });
}

async function parseRequestBody(request: Request) {
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > 4096) {
    throw new EmailMagicLinkError("request_too_large", 413);
  }
  const raw = await request.text();
  if (raw.length > 4096) throw new EmailMagicLinkError("request_too_large", 413);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();

  if (contentType === "application/json") {
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new EmailMagicLinkError("request_invalid");
    }
    if (typeof payload !== "object" || payload === null) throw new EmailMagicLinkError("request_invalid");
    const input = payload as Record<string, unknown>;
    return { email: input.email, returnTo: input.returnTo, csrfToken: input.csrfToken };
  }

  if (contentType === "application/x-www-form-urlencoded") {
    const form = new URLSearchParams(raw);
    return {
      email: form.get("email"),
      returnTo: form.get("returnTo"),
      csrfToken: form.get(REQUEST_SECURITY_PROFILE.anonymousCsrfFieldName),
    };
  }

  throw new EmailMagicLinkError("content_type_unsupported", 415);
}

function errorResponse(error: unknown) {
  if (error instanceof AuthRateLimitError) {
    const headers = new Headers(COMMON_HEADERS);
    headers.set("X-Celestial-Email-Magic", "rate-limited");
    headers.set("X-Celestial-Account-Persistence", "protected");
    applyRateLimitErrorHeaders(headers, error);
    return Response.json(
      { error: error.code, message: "Too many sign-in requests. Try again later." },
      { status: error.status, headers },
    );
  }
  const diagnostic =
    error instanceof EmailMagicLinkError ||
    error instanceof AccountPersistenceError ||
    error instanceof RequestSecurityError
      ? { code: error.code, status: error.status }
      : { code: "email_magic_start_unexpected", status: 500 };
  console.warn("Email magic-link request rejected", {
    code: diagnostic.code,
    status: diagnostic.status,
  });
  return Response.json(
    {
      error: diagnostic.code,
      message:
        diagnostic.status >= 500
          ? "The sign-in email could not be sent. Try again later."
          : diagnostic.status === 403
            ? "The sign-in form expired or was submitted from another site. Reload and try again."
            : "Enter a valid email address and try again.",
    },
    {
      status: diagnostic.status,
      headers: {
        ...COMMON_HEADERS,
        "X-Celestial-Email-Magic": "request-rejected",
        "X-Celestial-Email-Magic-Error": diagnostic.code,
        "X-Celestial-Account-Persistence": "failed",
      },
    },
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
      "Account persistence is not configured for this environment.",
    );
  }
  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return notFound();
  return requestForm(
    sanitizeReturnTo(requestUrl.searchParams.get("returnTo"), "/"),
    createAnonymousCsrfToken(),
  );
}

export async function POST(request: Request) {
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
      "Account persistence is not configured for this environment.",
    );
  }
  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return notFound();

  const store = new D1AccountIdentityStore(persistence.db);
  const rateLimitStore = new D1AuthRateLimitStore(persistence.db);
  let registeredFingerprint: string | null = null;
  try {
    const input = await parseRequestBody(request);
    assertAnonymousCsrf(request, input.csrfToken);
    await enforceAuthRateLimit(
      rateLimitStore,
      AUTH_RATE_LIMITS.emailStartClient,
      clientAddressKey(request),
    );
    const now = Date.now();
    const magicLink = await createEmailMagicLink(
      input.email,
      requestUrl.origin,
      input.returnTo,
      runtime.config.secret,
      now,
    );
    const addressLimit = await enforceAuthRateLimit(
      rateLimitStore,
      AUTH_RATE_LIMITS.emailStartAddress,
      magicLink.email,
    );
    await registerDurableMagicLink(store, {
      fingerprint: magicLink.fingerprint,
      email: magicLink.email,
      returnTo: input.returnTo,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + magicLink.expiresInSeconds * 1000).toISOString(),
    });
    registeredFingerprint = magicLink.fingerprint;
    await sendEmailMagicLink(
      runtime.config,
      magicLink.email,
      magicLink.verificationUrl,
      magicLink.fingerprint,
    );
    return sentResponse(magicLink.cookie, addressLimit);
  } catch (error) {
    if (registeredFingerprint) {
      try {
        await revokeDurableMagicLink(store, registeredFingerprint);
      } catch {
        console.warn("Email magic-link registration cleanup failed", {
          code: "email_magic_link_cleanup_failed",
        });
      }
    }
    return errorResponse(error);
  }
}

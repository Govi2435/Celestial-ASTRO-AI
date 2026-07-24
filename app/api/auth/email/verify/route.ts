import {
  EMAIL_MAGIC_LINK_PROFILE,
  EmailMagicLinkError,
  clearEmailMagicCookie,
  parseEmailMagicCookie,
  verifyEmailMagicLink,
} from "../../../../email-magic-link.ts";
import { loadEmailMagicLinkRuntime } from "../../../../email-magic-link-runtime.ts";

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
) {
  const headers = new Headers(COMMON_HEADERS);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Celestial-Email-Magic", outcome);
  if (diagnosticCode) headers.set("X-Celestial-Email-Magic-Error", diagnosticCode);
  headers.append("Set-Cookie", clearEmailMagicCookie());
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
    <p class="note">This staging flow verifies email only. It does not create a Celestial account or authenticated session yet.</p>
  </main>
</body>
</html>`;
  return new Response(html, { status, headers });
}

function notConfigured() {
  return htmlResponse(
    503,
    "Email sign-in unavailable",
    "Email magic-link sign-in is not configured for this environment.",
    "configuration-required",
    "email_magic_link_not_configured",
  );
}

export async function GET(request: Request) {
  const runtime = await loadEmailMagicLinkRuntime();
  if (runtime.appEnv !== "staging") return notFound();
  if (!runtime.config) return notConfigured();
  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") return notFound();

  try {
    const token = requestUrl.searchParams.get("token");
    const cookieValue = parseEmailMagicCookie(request.headers.get("cookie"));
    const identity = await verifyEmailMagicLink(
      token,
      cookieValue,
      runtime.config.secret,
    );
    if (identity.provider !== "email_magic_link" || !identity.emailVerified) {
      throw new EmailMagicLinkError("email_magic_identity_invalid");
    }

    return htmlResponse(
      200,
      "Email identity verified",
      `The ${EMAIL_MAGIC_LINK_PROFILE.id} provider flow completed successfully.`,
      "identity-verified",
    );
  } catch (error) {
    const diagnostic =
      error instanceof EmailMagicLinkError
        ? { code: error.code, status: error.status }
        : { code: "email_magic_verify_unexpected", status: 500 };
    console.warn("Email magic-link verification rejected", {
      code: diagnostic.code,
      status: diagnostic.status,
    });
    return htmlResponse(
      diagnostic.status >= 500 ? 502 : 400,
      "Email sign-in could not be verified",
      "The sign-in link was rejected. Request a new link in this browser.",
      "verification-failed",
      diagnostic.code,
    );
  }
}

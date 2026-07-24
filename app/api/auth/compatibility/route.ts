import {
  AUTH_COMPATIBILITY_PROFILE,
  clearCompatibilityCookie,
  createPkcePair,
  parseCompatibilityCookie,
  randomBase64Url,
  sanitizeReturnTo,
  serializeCompatibilityCookie,
  sha256Base64Url,
} from "../../../auth-compatibility.ts";

export const dynamic = "force-dynamic";

const COMMON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

async function isStagingRuntime() {
  try {
    const { env } = await import("cloudflare:workers");
    return env.APP_ENV === "staging";
  } catch {
    return false;
  }
}

function notFound() {
  return Response.json(
    { error: "not_found" },
    {
      status: 404,
      headers: COMMON_HEADERS,
    },
  );
}

function json(payload: Record<string, unknown>, init: ResponseInit = {}) {
  const headers = new Headers(COMMON_HEADERS);
  if (init.headers) {
    const supplied = new Headers(init.headers);
    supplied.forEach((value, name) => headers.set(name, value));
  }
  return Response.json(payload, { ...init, headers });
}

export async function GET(request: Request) {
  if (!(await isStagingRuntime())) return notFound();

  const url = new URL(request.url);
  if (url.searchParams.get("mode") === "redirect") {
    return new Response(null, {
      status: 302,
      headers: {
        ...COMMON_HEADERS,
        Location: "/api/auth/compatibility?mode=inspect",
      },
    });
  }

  const token = randomBase64Url(32);
  const tokenDigest = await sha256Base64Url(token);
  const pkce = await createPkcePair();
  const headers = new Headers(COMMON_HEADERS);
  headers.append("Set-Cookie", serializeCompatibilityCookie(token));

  return json(
    {
      status: "compatible",
      profile: AUTH_COMPATIBILITY_PROFILE.id,
      runtime: AUTH_COMPATIBILITY_PROFILE.runtime,
      capabilities: {
        routeHandlers: true,
        standardsRequestResponse: true,
        secureRandomValues: token.length === 43,
        webCryptoSha256: tokenDigest.length === 43,
        pkceS256:
          pkce.method === "S256" &&
          pkce.verifier.length >= 43 &&
          pkce.verifier.length <= 128 &&
          pkce.challenge.length === 43,
        secureHttpOnlyCookie: true,
        relativeRedirect: true,
      },
      warning: "Staging compatibility probe only. This does not create an account or authenticated session.",
    },
    { headers },
  );
}

export async function POST(request: Request) {
  if (!(await isStagingRuntime())) return notFound();

  const token = parseCompatibilityCookie(request.headers.get("cookie"));
  if (!token) {
    return json({ error: "probe_cookie_required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, { status: 400 });
  }

  const returnTo = sanitizeReturnTo(
    typeof body === "object" && body !== null && "returnTo" in body
      ? (body as { returnTo?: unknown }).returnTo
      : undefined,
    "/",
  );
  const digest = await sha256Base64Url(token);

  return json({
    status: "compatible",
    cookieRoundTrip: true,
    tokenHashing: digest.length === 43,
    safeReturnTo: returnTo,
  });
}

export async function DELETE() {
  if (!(await isStagingRuntime())) return notFound();

  const headers = new Headers(COMMON_HEADERS);
  headers.append("Set-Cookie", clearCompatibilityCookie());
  return new Response(null, { status: 204, headers });
}

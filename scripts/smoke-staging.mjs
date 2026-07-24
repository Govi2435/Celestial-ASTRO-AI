import assert from "node:assert/strict";

const baseUrlInput = process.argv[2] ?? process.env.STAGING_BASE_URL;
assert.ok(baseUrlInput, "Provide the staging deployment URL as an argument or STAGING_BASE_URL.");

const baseUrl = new URL(baseUrlInput);
assert.equal(baseUrl.protocol, "https:", "Staging smoke tests require HTTPS.");
assert.equal(baseUrl.username, "", "Staging URL must not contain credentials.");
assert.equal(baseUrl.password, "", "Staging URL must not contain credentials.");
assert.equal(baseUrl.search, "", "Staging URL must not contain a query string.");
assert.equal(baseUrl.hash, "", "Staging URL must not contain a fragment.");

const attempts = Number.parseInt(process.env.STAGING_SMOKE_ATTEMPTS ?? "12", 10);
const delayMs = Number.parseInt(process.env.STAGING_SMOKE_DELAY_MS ?? "5000", 10);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function request(pathname, init = {}) {
  const target = new URL(pathname, baseUrl);
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", pathname.startsWith("/api/") ? "application/json" : "text/html");
  }
  headers.set("User-Agent", "Celestial-ASTRO-AI-staging-smoke/1.0");

  const response = await fetch(target, {
    ...init,
    headers,
    redirect: init.redirect ?? "follow",
  });
  return { response, target };
}

function firstSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie()[0] ?? null;
  }
  return headers.get("set-cookie");
}

async function verifyGoogleOAuthStart() {
  const googleStart = await request("/api/auth/google/start?returnTo=%2Faccount", {
    redirect: "manual",
  });

  if (googleStart.response.status === 503) {
    const payload = await googleStart.response.json();
    assert.equal(payload.error, "google_oauth_not_configured");
    assert.equal(
      googleStart.response.headers.get("x-celestial-google-oauth"),
      "configuration-required",
    );
    return "configuration-pending";
  }

  assert.equal(googleStart.response.status, 200, "Google OAuth start must commit the cookie before navigation.");
  assert.equal(
    googleStart.response.headers.get("x-celestial-google-oauth"),
    "cookie-checkpoint",
  );
  assert.match(
    googleStart.response.headers.get("content-type") ?? "",
    /text\/html/i,
    "Google OAuth checkpoint must return HTML.",
  );
  assert.equal(googleStart.response.headers.get("refresh"), null, "Checkpoint must not auto-forward cross-site.");

  const setCookie = firstSetCookie(googleStart.response.headers);
  assert.ok(setCookie?.startsWith("__Host-celestial_google_oauth="), "Google OAuth transaction cookie is missing.");
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Max-Age=600/i);
  assert.doesNotMatch(setCookie, /Domain=/i);
  const cookiePair = setCookie.split(";", 1)[0];

  const handoffBody = await googleStart.response.text();
  assert.match(handoffBody, /href="\/api\/auth\/google\/continue"/i, "Google OAuth checkpoint link is missing.");

  const googleContinue = await request("/api/auth/google/continue", {
    redirect: "manual",
    headers: { Cookie: cookiePair },
  });
  assert.equal(googleContinue.response.status, 302, "Google OAuth checkpoint must redirect after cookie verification.");
  assert.equal(
    googleContinue.response.headers.get("x-celestial-google-oauth"),
    "checkpoint-passed",
  );

  const location = new URL(googleContinue.response.headers.get("location") ?? "");
  assert.equal(location.origin, "https://accounts.google.com");
  assert.equal(location.pathname, "/o/oauth2/v2/auth");
  assert.equal(location.searchParams.get("response_type"), "code");
  assert.equal(location.searchParams.get("redirect_uri"), new URL("/api/auth/google/callback", baseUrl).toString());
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.equal(location.searchParams.get("access_type"), "online");
  assert.equal(location.searchParams.get("prompt"), "select_account");
  assert.match(location.searchParams.get("state") ?? "", /^[A-Za-z0-9_-]{43}$/u);
  assert.match(location.searchParams.get("nonce") ?? "", /^[A-Za-z0-9_-]{43}$/u);
  assert.match(location.searchParams.get("code_challenge") ?? "", /^[A-Za-z0-9_-]{43}$/u);
  assert.deepEqual(
    new Set((location.searchParams.get("scope") ?? "").split(" ")),
    new Set(["openid", "email", "profile"]),
  );

  return "authorization-ready";
}

async function verify() {
  const homepage = await request("/");
  assert.equal(homepage.response.status, 200, `Homepage returned ${homepage.response.status}.`);
  assert.match(
    homepage.response.headers.get("content-type") ?? "",
    /text\/html/i,
    "Homepage must return HTML.",
  );
  const homepageBody = await homepage.response.text();
  assert.match(homepageBody, /Celestial ASTRO AI/i, "Homepage identity marker is missing.");

  const certification = await request("/api/certification");
  assert.equal(
    certification.response.status,
    200,
    `Certification API returned ${certification.response.status}.`,
  );
  assert.match(
    certification.response.headers.get("content-type") ?? "",
    /application\/json/i,
    "Certification API must return JSON.",
  );
  const payload = await certification.response.json();
  assert.ok(payload.certificate, "Certification payload is missing certificate data.");
  assert.ok(payload.engine, "Certification payload is missing engine data.");
  assert.ok(payload.methods?.ayanamsa, "Certification payload is missing ayanamsa data.");
  assert.ok(Array.isArray(payload.limitations), "Certification limitations must be an array.");

  const authProbe = await request("/api/auth/compatibility");
  assert.equal(authProbe.response.status, 200, `Auth compatibility probe returned ${authProbe.response.status}.`);
  assert.match(
    authProbe.response.headers.get("cache-control") ?? "",
    /no-store/i,
    "Auth compatibility response must not be cached.",
  );
  const authPayload = await authProbe.response.json();
  assert.equal(authPayload.status, "compatible", "Auth compatibility status must be compatible.");
  for (const [capability, supported] of Object.entries(authPayload.capabilities ?? {})) {
    assert.equal(supported, true, `Auth capability ${capability} did not pass.`);
  }

  const setCookie = firstSetCookie(authProbe.response.headers);
  assert.ok(setCookie?.startsWith("__Host-celestial_auth_probe="), "Secure probe cookie is missing.");
  assert.match(setCookie, /HttpOnly/i, "Probe cookie must be HttpOnly.");
  assert.match(setCookie, /Secure/i, "Probe cookie must be Secure.");
  assert.match(setCookie, /SameSite=Lax/i, "Probe cookie must use SameSite=Lax.");
  const cookiePair = setCookie.split(";", 1)[0];

  const cookieRoundTrip = await request("/api/auth/compatibility", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookiePair,
    },
    body: JSON.stringify({ returnTo: "/account/sessions?source=staging" }),
  });
  assert.equal(cookieRoundTrip.response.status, 200, "Auth cookie round-trip failed.");
  const roundTripPayload = await cookieRoundTrip.response.json();
  assert.equal(roundTripPayload.cookieRoundTrip, true, "Auth cookie was not returned to the route handler.");
  assert.equal(roundTripPayload.tokenHashing, true, "Auth token hashing did not pass.");
  assert.equal(
    roundTripPayload.safeReturnTo,
    "/account/sessions?source=staging",
    "Same-origin OAuth return target was not preserved.",
  );

  const redirectProbe = await request("/api/auth/compatibility?mode=redirect", {
    redirect: "manual",
  });
  assert.equal(redirectProbe.response.status, 302, "Auth redirect compatibility failed.");
  assert.match(
    redirectProbe.response.headers.get("location") ?? "",
    /\/api\/auth\/compatibility\?mode=inspect$/,
    "Auth redirect target is invalid.",
  );

  const clearProbe = await request("/api/auth/compatibility", {
    method: "DELETE",
    headers: { Cookie: cookiePair },
  });
  assert.equal(clearProbe.response.status, 204, "Auth cookie clear request failed.");
  assert.match(firstSetCookie(clearProbe.response.headers) ?? "", /Max-Age=0/i, "Auth cookie was not cleared.");

  const googleOAuth = await verifyGoogleOAuthStart();

  return {
    homepage: homepage.target.href,
    certification: certification.target.href,
    authCompatibility: authProbe.target.href,
    googleOAuth,
    certificateHeader: certification.response.headers.get("x-celestial-certificate"),
  };
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const result = await verify();
    console.log(`[staging-smoke] PASS attempt=${attempt} base=${baseUrl.origin}`);
    console.log(`[staging-smoke] homepage=${result.homepage}`);
    console.log(`[staging-smoke] certification=${result.certification}`);
    console.log(`[staging-smoke] authCompatibility=${result.authCompatibility}`);
    console.log(`[staging-smoke] googleOAuth=${result.googleOAuth}`);
    console.log(
      `[staging-smoke] certificate=${result.certificateHeader ?? "header-not-present"}`,
    );
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(
      `[staging-smoke] attempt=${attempt}/${attempts} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    if (attempt < attempts) {
      await delay(delayMs);
    }
  }
}

throw lastError;

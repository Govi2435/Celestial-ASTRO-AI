import assert from "node:assert/strict";

const baseUrlInput = process.argv[2] ?? process.env.STAGING_BASE_URL;
assert.ok(baseUrlInput, "Provide the staging deployment URL as an argument or STAGING_BASE_URL.");
const baseUrl = new URL(baseUrlInput);
assert.equal(baseUrl.protocol, "https:");
assert.equal(baseUrl.username, "");
assert.equal(baseUrl.password, "");
assert.equal(baseUrl.search, "");
assert.equal(baseUrl.hash, "");

const attempts = Number.parseInt(process.env.STAGING_SMOKE_ATTEMPTS ?? "12", 10);
const delayMs = Number.parseInt(process.env.STAGING_SMOKE_DELAY_MS ?? "5000", 10);
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function request(pathname, init = {}) {
  const target = new URL(pathname, baseUrl);
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", pathname.startsWith("/api/") ? "application/json" : "text/html");
  headers.set("User-Agent", "Celestial-ASTRO-AI-staging-smoke/1.0");
  const response = await fetch(target, { ...init, headers, redirect: init.redirect ?? "follow" });
  return { response, target };
}

function firstSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie()[0] ?? null;
  return headers.get("set-cookie");
}

async function verifyGoogleOAuthStart() {
  const googleStart = await request("/api/auth/google/start?returnTo=%2Faccount", { redirect: "manual" });
  if (googleStart.response.status === 503) {
    const payload = await googleStart.response.json();
    assert.ok(
      ["google_oauth_not_configured", "account_persistence_not_configured"].includes(payload.error),
      `Unexpected Google configuration error: ${payload.error}`,
    );
    assert.equal(googleStart.response.headers.get("x-celestial-google-oauth"), "configuration-required");
    return payload.error;
  }

  assert.equal(googleStart.response.status, 200, "Google OAuth start must commit the cookie before navigation.");
  assert.equal(googleStart.response.headers.get("x-celestial-google-oauth"), "cookie-checkpoint");
  assert.equal(googleStart.response.headers.get("x-celestial-account-persistence"), "ready");
  assert.match(googleStart.response.headers.get("content-type") ?? "", /text\/html/i);
  assert.equal(googleStart.response.headers.get("refresh"), null);
  const setCookie = firstSetCookie(googleStart.response.headers);
  assert.ok(setCookie?.startsWith("__Host-celestial_google_oauth="));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Max-Age=600/i);
  assert.doesNotMatch(setCookie, /Domain=/i);
  const cookiePair = setCookie.split(";", 1)[0];
  const handoffBody = await googleStart.response.text();
  assert.match(handoffBody, /href="\/api\/auth\/google\/continue"/i);

  const googleContinue = await request("/api/auth/google/continue", {
    redirect: "manual",
    headers: { Cookie: cookiePair },
  });
  assert.equal(googleContinue.response.status, 302);
  assert.equal(googleContinue.response.headers.get("x-celestial-google-oauth"), "checkpoint-passed");
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
  assert.deepEqual(new Set((location.searchParams.get("scope") ?? "").split(" ")), new Set(["openid", "email", "profile"]));
  return "authorization-ready";
}

async function verifyEmailMagicStart() {
  const emailStart = await request("/api/auth/email/start?returnTo=%2Faccount", { redirect: "manual" });
  if (emailStart.response.status === 503) {
    const payload = await emailStart.response.json();
    assert.ok(
      ["email_magic_link_not_configured", "account_persistence_not_configured"].includes(payload.error),
      `Unexpected email configuration error: ${payload.error}`,
    );
    assert.equal(emailStart.response.headers.get("x-celestial-email-magic"), "configuration-required");
    return payload.error;
  }
  assert.equal(emailStart.response.status, 200);
  assert.equal(emailStart.response.headers.get("x-celestial-email-magic"), "request-ready");
  assert.equal(emailStart.response.headers.get("x-celestial-account-persistence"), "ready");
  const body = await emailStart.response.text();
  assert.match(body, /<form method="post" action="\/api\/auth\/email\/start">/i);
  assert.match(body, /type="email"/i);
  return "request-ready";
}

async function verify() {
  const homepage = await request("/");
  assert.equal(homepage.response.status, 200);
  assert.match(homepage.response.headers.get("content-type") ?? "", /text\/html/i);
  assert.match(await homepage.response.text(), /Celestial ASTRO AI/i);

  const certification = await request("/api/certification");
  assert.equal(certification.response.status, 200);
  assert.match(certification.response.headers.get("content-type") ?? "", /application\/json/i);
  const payload = await certification.response.json();
  assert.ok(payload.certificate);
  assert.ok(payload.engine);
  assert.ok(payload.methods?.ayanamsa);
  assert.ok(Array.isArray(payload.limitations));

  const authProbe = await request("/api/auth/compatibility");
  assert.equal(authProbe.response.status, 200);
  assert.match(authProbe.response.headers.get("cache-control") ?? "", /no-store/i);
  const authPayload = await authProbe.response.json();
  assert.equal(authPayload.status, "compatible");
  for (const [capability, supported] of Object.entries(authPayload.capabilities ?? {})) {
    assert.equal(supported, true, `Auth capability ${capability} did not pass.`);
  }
  const setCookie = firstSetCookie(authProbe.response.headers);
  assert.ok(setCookie?.startsWith("__Host-celestial_auth_probe="));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookiePair = setCookie.split(";", 1)[0];

  const cookieRoundTrip = await request("/api/auth/compatibility", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookiePair },
    body: JSON.stringify({ returnTo: "/account/sessions?source=staging" }),
  });
  assert.equal(cookieRoundTrip.response.status, 200);
  const roundTripPayload = await cookieRoundTrip.response.json();
  assert.equal(roundTripPayload.cookieRoundTrip, true);
  assert.equal(roundTripPayload.tokenHashing, true);
  assert.equal(roundTripPayload.safeReturnTo, "/account/sessions?source=staging");

  const redirectProbe = await request("/api/auth/compatibility?mode=redirect", { redirect: "manual" });
  assert.equal(redirectProbe.response.status, 302);
  assert.match(redirectProbe.response.headers.get("location") ?? "", /\/api\/auth\/compatibility\?mode=inspect$/);

  const clearProbe = await request("/api/auth/compatibility", { method: "DELETE", headers: { Cookie: cookiePair } });
  assert.equal(clearProbe.response.status, 204);
  assert.match(firstSetCookie(clearProbe.response.headers) ?? "", /Max-Age=0/i);

  return {
    homepage: homepage.target.href,
    certification: certification.target.href,
    authCompatibility: authProbe.target.href,
    googleOAuth: await verifyGoogleOAuthStart(),
    emailMagicLink: await verifyEmailMagicStart(),
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
    console.log(`[staging-smoke] emailMagicLink=${result.emailMagicLink}`);
    console.log(`[staging-smoke] certificate=${result.certificateHeader ?? "header-not-present"}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`[staging-smoke] attempt=${attempt}/${attempts} failed: ${error instanceof Error ? error.message : String(error)}`);
    if (attempt < attempts) await delay(delayMs);
  }
}
throw lastError;

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

  return {
    homepage: homepage.target.href,
    certification: certification.target.href,
    authCompatibility: authProbe.target.href,
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

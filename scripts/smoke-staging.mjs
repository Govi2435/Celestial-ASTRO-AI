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

async function request(pathname) {
  const target = new URL(pathname, baseUrl);
  const response = await fetch(target, {
    headers: {
      Accept: pathname.startsWith("/api/") ? "application/json" : "text/html",
      "User-Agent": "Celestial-ASTRO-AI-staging-smoke/1.0",
    },
    redirect: "follow",
  });
  return { response, target };
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

  return {
    homepage: homepage.target.href,
    certification: certification.target.href,
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

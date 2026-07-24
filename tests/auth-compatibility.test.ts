import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AUTH_COMPATIBILITY_PROFILE,
  clearCompatibilityCookie,
  createPkcePair,
  parseCompatibilityCookie,
  randomBase64Url,
  sanitizeReturnTo,
  serializeCompatibilityCookie,
  sha256Base64Url,
} from "../app/auth-compatibility.ts";

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
const routeSource = readFileSync(
  new URL("../app/api/auth/compatibility/route.ts", import.meta.url),
  "utf8",
);

test("secure random tokens are bounded base64url values", () => {
  const first = randomBase64Url(32);
  const second = randomBase64Url(32);

  assert.equal(first.length, 43);
  assert.match(first, base64UrlPattern);
  assert.notEqual(first, second);
  assert.throws(() => randomBase64Url(8), /between 16 and 96/);
});

test("Web Crypto SHA-256 and PKCE S256 produce OAuth-safe values", async () => {
  assert.equal(
    await sha256Base64Url("celestial-auth-compatibility"),
    "qUV4VZD8eOCebnVnSb96MPvCz3L6_Xq4UceNle-ZGXw",
  );

  const pair = await createPkcePair();
  assert.equal(pair.method, "S256");
  assert.ok(pair.verifier.length >= 43 && pair.verifier.length <= 128);
  assert.match(pair.verifier, base64UrlPattern);
  assert.equal(pair.challenge, await sha256Base64Url(pair.verifier));
  assert.equal(pair.challenge.length, 43);
});

test("probe cookie uses the required host-only security attributes", () => {
  const token = randomBase64Url(32);
  const serialized = serializeCompatibilityCookie(token);

  assert.match(serialized, new RegExp(`^${AUTH_COMPATIBILITY_PROFILE.cookieName}=`));
  assert.match(serialized, /; Path=\//);
  assert.match(serialized, /; HttpOnly/);
  assert.match(serialized, /; Secure/);
  assert.match(serialized, /; SameSite=Lax/);
  assert.match(serialized, /; Max-Age=300/);
  assert.doesNotMatch(serialized, /Domain=/i);
  assert.equal(
    parseCompatibilityCookie(`other=value; ${AUTH_COMPATIBILITY_PROFILE.cookieName}=${token}`),
    token,
  );
  assert.equal(parseCompatibilityCookie("other=value"), null);
  assert.match(clearCompatibilityCookie(), /Max-Age=0/);
});

test("OAuth return targets remain same-origin relative paths", () => {
  assert.equal(sanitizeReturnTo("/account/sessions?source=login"), "/account/sessions?source=login");
  assert.equal(sanitizeReturnTo("https://evil.example/steal"), "/");
  assert.equal(sanitizeReturnTo("//evil.example/steal"), "/");
  assert.equal(sanitizeReturnTo("/\\evil.example"), "/");
  assert.equal(sanitizeReturnTo(undefined, "/account"), "/account");
});

test("compatibility probe is staging-only and does not claim authentication", () => {
  assert.match(routeSource, /env\.APP_ENV === "staging"/);
  assert.match(routeSource, /status: 404/);
  assert.match(routeSource, /Staging compatibility probe only/);
  assert.match(routeSource, /This does not create an account or authenticated session/);
  assert.match(routeSource, /"Cache-Control": "no-store, max-age=0"/);
  assert.doesNotMatch(routeSource, /OPENAI_API_KEY|RAZORPAY|GOOGLE_CLIENT_SECRET|MAGIC_LINK_SECRET/);
  assert.doesNotMatch(routeSource, /console\.(log|error|warn)/);
});

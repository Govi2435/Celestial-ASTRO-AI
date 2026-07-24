import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const googleCallback = readFileSync(
  new URL("../app/api/auth/google/callback/route.ts", import.meta.url),
  "utf8",
);
const emailVerify = readFileSync(
  new URL("../app/api/auth/email/verify/route.ts", import.meta.url),
  "utf8",
);
const sessionRoute = readFileSync(
  new URL("../app/api/auth/session/route.ts", import.meta.url),
  "utf8",
);
const logoutRoute = readFileSync(
  new URL("../app/api/auth/logout/route.ts", import.meta.url),
  "utf8",
);
const sessionCore = readFileSync(
  new URL("../app/server-session.ts", import.meta.url),
  "utf8",
);
const sessionD1 = readFileSync(
  new URL("../app/server-session-d1.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL("../drizzle/0004_p9_secure_server_sessions.sql", import.meta.url),
  "utf8",
);

test("verified Google and email identities issue server sessions", () => {
  for (const source of [googleCallback, emailVerify]) {
    assert.match(source, /createServerSession/u);
    assert.match(source, /D1ServerSessionStore/u);
    assert.match(source, /X-Celestial-Session/u);
    assert.match(source, /Set-Cookie/u);
    assert.doesNotMatch(source, /console\.(?:log|warn)\([^\n]*(?:token|cookie)/u);
  }
  assert.match(googleCallback, /authMethod: "google"/u);
  assert.match(emailVerify, /authMethod: "email_magic_link"/u);
});

test("current-session route validates, rotates, and returns bounded identity data", () => {
  assert.match(sessionRoute, /authenticateServerSession/u);
  assert.match(sessionRoute, /X-Celestial-Session/u);
  assert.match(sessionRoute, /clearServerSessionCookie/u);
  assert.match(sessionRoute, /authenticated: true/u);
  assert.doesNotMatch(sessionRoute, /tokenHash|identityId/u);
});

test("logout is POST-only, session-authenticated, CSRF guarded, throttled, and clears the cookie", () => {
  assert.match(logoutRoute, /export async function POST/u);
  assert.doesNotMatch(logoutRoute, /export async function GET/u);
  assert.match(logoutRoute, /authenticateServerSession/u);
  assert.match(logoutRoute, /assertSessionCsrf/u);
  assert.match(logoutRoute, /AUTH_RATE_LIMITS\.logout/u);
  assert.match(logoutRoute, /enforceAuthRateLimit/u);
  assert.match(logoutRoute, /revokeServerSession/u);
  assert.match(logoutRoute, /clearServerSessionCookie/u);
});

test("session tokens are opaque in cookies and hashed in persistence", () => {
  assert.match(sessionCore, /__Host-celestial_session/u);
  assert.match(sessionCore, /HttpOnly/u);
  assert.match(sessionCore, /Secure/u);
  assert.match(sessionCore, /SameSite=/u);
  assert.match(sessionCore, /sha256Base64Url\(token\)/u);
  assert.match(sessionCore, /rotationIntervalSeconds/u);
  assert.match(sessionCore, /absoluteLifetimeSeconds/u);
  assert.match(sessionD1, /WHERE token_hash = \? LIMIT 1/u);
  assert.doesNotMatch(sessionD1, /INSERT INTO auth_sessions[^\n]*\btoken\b(?!_hash)/u);
});

test("session migration enforces account binding, token uniqueness, expiry, and revocation fields", () => {
  assert.match(migration, /CREATE TABLE `auth_sessions`/u);
  assert.match(migration, /FOREIGN KEY \(`account_id`\) REFERENCES `accounts`/u);
  assert.match(migration, /FOREIGN KEY \(`identity_id`\) REFERENCES `account_identities`/u);
  assert.match(migration, /auth_sessions_token_hash_unique/u);
  assert.match(migration, /`expires_at` text NOT NULL/u);
  assert.match(migration, /`absolute_expires_at` text NOT NULL/u);
  assert.match(migration, /`revoked_at` text/u);
  assert.match(migration, /`rotation_count` integer DEFAULT 0 NOT NULL/u);
});

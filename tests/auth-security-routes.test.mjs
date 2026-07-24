import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const requestSecurity = readFileSync(new URL("../app/request-security.ts", import.meta.url), "utf8");
const rateLimit = readFileSync(new URL("../app/auth-rate-limit.ts", import.meta.url), "utf8");
const rateLimitD1 = readFileSync(new URL("../app/auth-rate-limit-d1.ts", import.meta.url), "utf8");
const googleStart = readFileSync(new URL("../app/api/auth/google/start/route.ts", import.meta.url), "utf8");
const emailStart = readFileSync(new URL("../app/api/auth/email/start/route.ts", import.meta.url), "utf8");
const sessions = readFileSync(new URL("../app/api/auth/sessions/route.ts", import.meta.url), "utf8");
const logout = readFileSync(new URL("../app/api/auth/logout/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../drizzle/0005_p9_csrf_rate_limits.sql", import.meta.url), "utf8");

test("email sign-in form uses a host-only double-submit CSRF token", () => {
  assert.match(emailStart, /createAnonymousCsrfToken/);
  assert.match(emailStart, /serializeAnonymousCsrfCookie/);
  assert.match(emailStart, /assertAnonymousCsrf/);
  assert.match(emailStart, /name="\$\{REQUEST_SECURITY_PROFILE\.anonymousCsrfFieldName\}"/);
  assert.match(requestSecurity, /__Host-celestial_email_csrf/);
  assert.match(requestSecurity, /HttpOnly/);
  assert.match(requestSecurity, /SameSite=Strict/);
  assert.match(requestSecurity, /origin !== requestUrl\.origin/);
  assert.match(requestSecurity, /request_site_rejected/);
});

test("login and session entry points consume bounded D1 rate limits", () => {
  assert.match(googleStart, /AUTH_RATE_LIMITS\.googleStart/);
  assert.match(emailStart, /AUTH_RATE_LIMITS\.emailStartClient/);
  assert.match(emailStart, /AUTH_RATE_LIMITS\.emailStartAddress/);
  assert.match(sessions, /AUTH_RATE_LIMITS\.sessionMutation/);
  assert.match(logout, /AUTH_RATE_LIMITS\.logout/);
  for (const source of [googleStart, emailStart, sessions, logout]) {
    assert.match(source, /enforceAuthRateLimit/);
  }
  assert.match(rateLimit, /Retry-After/);
  assert.match(rateLimit, /RateLimit-Remaining/);
});

test("D1 rate limits increment atomically and persist only hashed buckets", () => {
  assert.match(rateLimitD1, /ON CONFLICT\(bucket_hash\) DO UPDATE/);
  assert.match(rateLimitD1, /request_count \+ 1/);
  assert.match(rateLimitD1, /RETURNING request_count, window_expires_at/);
  assert.match(rateLimit, /sha256Base64Url/);
  assert.doesNotMatch(rateLimitD1, /email|cf-connecting-ip|account_id/);
});

test("security migration adds hashed CSRF state and durable limit buckets", () => {
  assert.match(migration, /ALTER TABLE `auth_sessions` ADD COLUMN `csrf_token_hash`/);
  assert.match(migration, /ALTER TABLE `auth_sessions` ADD COLUMN `csrf_issued_at`/);
  assert.match(migration, /CREATE TABLE `auth_rate_limits`/);
  assert.match(migration, /`bucket_hash` text PRIMARY KEY NOT NULL/);
  assert.match(migration, /`request_count` integer DEFAULT 0 NOT NULL/);
  assert.doesNotMatch(migration, /email|ip_address|session_token/);
});

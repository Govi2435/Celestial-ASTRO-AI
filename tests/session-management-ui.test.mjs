import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("../app/account/sessions/page.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/account/sessions/sessions.module.css", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../app/api/auth/sessions/route.ts", import.meta.url),
  "utf8",
);
const logout = readFileSync(
  new URL("../app/api/auth/logout/route.ts", import.meta.url),
  "utf8",
);
const store = readFileSync(
  new URL("../app/server-session-d1.ts", import.meta.url),
  "utf8",
);
const core = readFileSync(
  new URL("../app/session-management.ts", import.meta.url),
  "utf8",
);

const requestSecurity = readFileSync(
  new URL("../app/request-security.ts", import.meta.url),
  "utf8",
);

const rateLimit = readFileSync(
  new URL("../app/auth-rate-limit.ts", import.meta.url),
  "utf8",
);

test("session console exposes accessible authenticated and anonymous states", () => {
  assert.match(page, /Your signed-in/);
  assert.match(page, /Sign in to manage sessions/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /aria-labelledby="sessions-heading"/);
  assert.match(page, /Continue with Google/);
  assert.match(page, /Use email magic link/);
  assert.match(page, /Sign out other sessions/);
  assert.match(page, /Revoke session/);
  assert.match(page, /Sign out this browser/);
  assert.match(page, /Token-safe by design/);
});

test("session UI sends server-issued CSRF tokens without reading cookies", () => {
  assert.match(page, /fetch\("\/api\/auth\/sessions"/);
  assert.match(page, /fetch\("\/api\/auth\/logout"/);
  assert.match(page, /credentials: "include"/);
  assert.match(page, /csrfToken/);
  assert.match(page, /"X-Celestial-CSRF": view\.csrfToken/);
  assert.doesNotMatch(page, /document\.cookie|localStorage|sessionStorage/);
  assert.doesNotMatch(page, /tokenHash|token_hash/);
  assert.match(logout, /clearServerSessionCookie/);
});

test("management API authenticates, verifies CSRF, and rate limits every mutation", () => {
  assert.match(route, /authenticateServerSession/);
  assert.match(route, /assertTrustedMutation/);
  assert.match(route, /assertSessionCsrf/);
  assert.match(route, /issueSessionCsrf/);
  assert.match(route, /AUTH_RATE_LIMITS\.sessionMutation/);
  assert.match(route, /enforceAuthRateLimit/);
  assert.match(route, /session_management_content_type_invalid/);
  assert.match(route, /revokeManagedSession/);
  assert.match(route, /revokeOtherManagedSessions/);
  assert.match(route, /clearServerSessionCookie/);
  assert.doesNotMatch(route, /tokenHash|token_hash/);
  assert.match(logout, /assertSessionCsrf/);
  assert.match(logout, /AUTH_RATE_LIMITS\.logout/);
});

test("request security rejects cross-site mutations and stores only CSRF hashes", () => {
  assert.match(requestSecurity, /origin !== requestUrl\.origin/);
  assert.match(requestSecurity, /sec-fetch-site/);
  assert.match(requestSecurity, /sha256Base64Url\(token\)/);
  assert.match(store, /csrf_token_hash = \?/);
  assert.match(store, /matchesSessionCsrfTokenHash/);
  assert.doesNotMatch(store, /csrf_token(?!_hash)/);
  assert.match(rateLimit, /sha256Base64Url\(`\$\{profile\.scope\}\\n\$\{keyMaterial\}`\)/);
});

test("D1 mutations are scoped to the authenticated account", () => {
  assert.match(store, /WHERE account_id = \?/);
  assert.match(store, /WHERE id = \? AND account_id = \? AND revoked_at IS NULL/);
  assert.match(store, /WHERE account_id = \? AND id <> \? AND revoked_at IS NULL/);
  assert.match(store, /Math\.min\(25/);
  assert.match(core, /current_session_requires_logout/);
  assert.match(core, /account\.session\.revoked_by_user/);
  assert.match(core, /account\.session\.others_revoked/);
});

test("session console has responsive and reduced-motion coverage", () => {
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /\.currentCard/);
});

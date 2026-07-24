import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUEST_SECURITY_PROFILE,
  RequestSecurityError,
  assertAnonymousCsrf,
  assertSessionCsrf,
  assertTrustedMutation,
  createAnonymousCsrfToken,
  issueSessionCsrf,
  serializeAnonymousCsrfCookie,
  type SessionCsrfStore,
} from "../app/request-security.ts";

class MemoryCsrfStore implements SessionCsrfStore {
  readonly hashes = new Map<string, string>();

  async setSessionCsrfTokenHash(sessionId: string, tokenHash: string) {
    this.hashes.set(sessionId, tokenHash);
    return true;
  }

  async matchesSessionCsrfTokenHash(sessionId: string, tokenHash: string) {
    return this.hashes.get(sessionId) === tokenHash;
  }
}

function mutationRequest(headers: Record<string, string>) {
  return new Request("https://example.test/api/auth/sessions", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
}

test("trusted mutations require HTTPS, exact origin, and same-origin fetch metadata", () => {
  assert.doesNotThrow(() => assertTrustedMutation(mutationRequest({})));
  assert.throws(
    () => assertTrustedMutation(new Request("https://example.test/api", { method: "POST" })),
    (error) => error instanceof RequestSecurityError && error.code === "request_origin_rejected",
  );
  assert.throws(
    () => assertTrustedMutation(mutationRequest({ origin: "https://attacker.test" })),
    (error) => error instanceof RequestSecurityError && error.code === "request_origin_rejected",
  );
  assert.throws(
    () => assertTrustedMutation(mutationRequest({ "sec-fetch-site": "cross-site" })),
    (error) => error instanceof RequestSecurityError && error.code === "request_site_rejected",
  );
});

test("session CSRF tokens are random, stored only as hashes, and verified by session", async () => {
  const store = new MemoryCsrfStore();
  const token = await issueSessionCsrf(store, "ses_1", new Date("2026-07-24T12:00:00.000Z"));
  assert.match(token, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(store.hashes.get("ses_1"), token);

  await assertSessionCsrf(
    mutationRequest({ [REQUEST_SECURITY_PROFILE.sessionCsrfHeader]: token }),
    store,
    "ses_1",
  );
  await assert.rejects(
    () =>
      assertSessionCsrf(
        mutationRequest({ [REQUEST_SECURITY_PROFILE.sessionCsrfHeader]: "A".repeat(43) }),
        store,
        "ses_1",
      ),
    (error) => error instanceof RequestSecurityError && error.code === "csrf_token_invalid",
  );
});

test("email form CSRF uses a host-only HttpOnly Strict cookie and double submission", () => {
  const token = createAnonymousCsrfToken();
  const setCookie = serializeAnonymousCsrfCookie(token);
  assert.match(setCookie, /^__Host-celestial_email_csrf=/u);
  assert.match(setCookie, /Path=\//u);
  assert.match(setCookie, /HttpOnly/u);
  assert.match(setCookie, /Secure/u);
  assert.match(setCookie, /SameSite=Strict/u);
  assert.doesNotMatch(setCookie, /Domain=/u);

  const request = mutationRequest({
    cookie: `${REQUEST_SECURITY_PROFILE.anonymousCsrfCookieName}=${token}`,
  });
  assert.doesNotThrow(() => assertAnonymousCsrf(request, token));
  assert.throws(
    () => assertAnonymousCsrf(request, "B".repeat(43)),
    (error) => error instanceof RequestSecurityError && error.code === "csrf_token_invalid",
  );
});

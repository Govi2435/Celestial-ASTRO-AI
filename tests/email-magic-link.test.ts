import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmailMagicLink,
  parseEmailMagicCookie,
  verifyEmailMagicLink,
} from "../app/email-magic-link.ts";

const secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG-magic-link-secret";
const origin = "https://cosmicsphere-staging.example.workers.dev";

function cookieValue(setCookie: string) {
  const pair = setCookie.split(";", 1)[0];
  return pair.slice(pair.indexOf("=") + 1);
}

test("email magic link encrypts identity and verifies against the requesting browser", async () => {
  const issuedAt = Date.UTC(2026, 6, 24, 10, 0, 0);
  const link = await createEmailMagicLink(
    " Person@Example.COM ",
    origin,
    "/account/sessions?source=email",
    secret,
    issuedAt,
  );

  const url = new URL(link.verificationUrl);
  assert.equal(url.origin, origin);
  assert.equal(url.pathname, "/api/auth/email/verify");
  assert.ok(url.searchParams.get("token"));
  assert.doesNotMatch(link.verificationUrl, /person%40example\.com|person@example\.com/i);
  assert.equal(link.email, "person@example.com");
  assert.equal(link.fingerprint.length, 43);
  assert.equal(link.expiresInSeconds, 600);

  assert.match(link.cookie, /^__Host-celestial_email_magic=/);
  assert.match(link.cookie, /; Path=\//);
  assert.match(link.cookie, /; HttpOnly/);
  assert.match(link.cookie, /; Secure/);
  assert.match(link.cookie, /; SameSite=Lax/);
  assert.match(link.cookie, /; Max-Age=600/);
  assert.doesNotMatch(link.cookie, /Domain=/i);
  assert.ok(parseEmailMagicCookie(link.cookie));

  const identity = await verifyEmailMagicLink(
    url.searchParams.get("token"),
    cookieValue(link.cookie),
    secret,
    issuedAt + 30_000,
  );
  assert.deepEqual(identity, {
    provider: "email_magic_link",
    email: "person@example.com",
    emailVerified: true,
    returnTo: "/account/sessions?source=email",
  });
});

test("email magic link rejects tampering, expiry and a different browser transaction", async () => {
  const issuedAt = Date.UTC(2026, 6, 24, 10, 0, 0);
  const first = await createEmailMagicLink("first@example.com", origin, "/", secret, issuedAt);
  const second = await createEmailMagicLink("second@example.com", origin, "/", secret, issuedAt);
  const firstToken = new URL(first.verificationUrl).searchParams.get("token") as string;
  const replacement = firstToken.endsWith("A") ? "B" : "A";
  const tamperedToken = `${firstToken.slice(0, -1)}${replacement}`;

  await assert.rejects(
    verifyEmailMagicLink(tamperedToken, cookieValue(first.cookie), secret, issuedAt + 1_000),
    /email_magic_link_invalid|email_magic_transaction_mismatch/,
  );
  await assert.rejects(
    verifyEmailMagicLink(firstToken, cookieValue(second.cookie), secret, issuedAt + 1_000),
    /email_magic_transaction_mismatch/,
  );
  await assert.rejects(
    verifyEmailMagicLink(firstToken, cookieValue(first.cookie), secret, issuedAt + 601_000),
    /email_magic_link_expired/,
  );
  await assert.rejects(
    verifyEmailMagicLink(firstToken, null, secret, issuedAt + 1_000),
    /email_magic_transaction_missing/,
  );
});

test("email magic link rejects unsafe email and cross-origin return targets", async () => {
  await assert.rejects(
    createEmailMagicLink("not-an-email", origin, "/", secret),
    /email_invalid/,
  );
  const link = await createEmailMagicLink(
    "person@example.com",
    origin,
    "https://evil.example/steal",
    secret,
    Date.UTC(2026, 6, 24, 10, 0, 0),
  );
  const identity = await verifyEmailMagicLink(
    new URL(link.verificationUrl).searchParams.get("token"),
    cookieValue(link.cookie),
    secret,
    Date.UTC(2026, 6, 24, 10, 0, 30),
  );
  assert.equal(identity.returnTo, "/");
});

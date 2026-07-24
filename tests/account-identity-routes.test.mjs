import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const googleStart = readFileSync(new URL("../app/api/auth/google/start/route.ts", import.meta.url), "utf8");
const googleCallback = readFileSync(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8");
const emailStart = readFileSync(new URL("../app/api/auth/email/start/route.ts", import.meta.url), "utf8");
const emailVerify = readFileSync(new URL("../app/api/auth/email/verify/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../drizzle/0003_p9_account_identity_persistence.sql", import.meta.url), "utf8");

test("Google and email provider routes require the isolated D1 persistence binding", () => {
  for (const source of [googleStart, googleCallback, emailStart, emailVerify]) {
    assert.match(source, /loadAccountPersistenceRuntime/);
    assert.match(source, /account_persistence_not_configured/);
    assert.match(source, /X-Celestial-Account-Persistence/);
  }
  assert.match(googleCallback, /persistVerifiedIdentity/);
  assert.match(emailVerify, /persistVerifiedIdentity/);
});

test("email magic links use durable registration and conditional one-time consumption", () => {
  assert.match(emailStart, /registerDurableMagicLink/);
  assert.match(emailStart, /revokeDurableMagicLink/);
  assert.match(emailVerify, /verifyDurableEmailMagicLink/);
  assert.match(emailVerify, /assertDurableMagicLinkConsumable/);
  assert.match(emailVerify, /consumeDurableMagicLink/);
  assert.doesNotMatch(emailVerify, /parseEmailMagicCookie|verifyEmailMagicLink\(/);
});

test("account persistence migration enforces provider and token uniqueness", () => {
  assert.match(migration, /CREATE TABLE `account_identities`/);
  assert.match(migration, /account_identities_provider_subject_unique/);
  assert.match(migration, /account_identities_account_provider_unique/);
  assert.match(migration, /CREATE TABLE `email_magic_link_tokens`/);
  assert.match(migration, /`fingerprint` text PRIMARY KEY NOT NULL/);
  assert.match(migration, /`consumed_at` text/);
});

test("ASTRO-124 does not issue an authenticated session", () => {
  for (const source of [googleCallback, emailVerify]) {
    assert.doesNotMatch(source, /celestial_session|sessionToken|createSession|Set-Cookie[^\n]*session/i);
    assert.match(source, /does not create an authenticated session yet/);
  }
});

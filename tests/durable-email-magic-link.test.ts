import assert from "node:assert/strict";
import test from "node:test";
import { verifyDurableEmailMagicLink } from "../app/durable-email-magic-link.ts";
import { createEmailMagicLink } from "../app/email-magic-link.ts";

const secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG-magic-link-secret";
const origin = "https://cosmicsphere-staging.example.workers.dev";

test("durable verification accepts a registered encrypted link without a browser cookie", async () => {
  const issuedAt = Date.UTC(2026, 6, 24, 10, 0, 0);
  const link = await createEmailMagicLink(
    "Person@Example.com",
    origin,
    "/account?source=email",
    secret,
    issuedAt,
  );
  const token = new URL(link.verificationUrl).searchParams.get("token");
  const verified = await verifyDurableEmailMagicLink(token, secret, issuedAt + 30_000);
  assert.deepEqual(
    {
      provider: verified.provider,
      email: verified.email,
      emailVerified: verified.emailVerified,
      returnTo: verified.returnTo,
      fingerprint: verified.fingerprint,
      issuedAt: verified.issuedAt,
      expiresAt: verified.expiresAt,
    },
    {
      provider: "email_magic_link",
      email: "person@example.com",
      emailVerified: true,
      returnTo: "/account?source=email",
      fingerprint: link.fingerprint,
      issuedAt,
      expiresAt: new Date(issuedAt + 600_000).toISOString(),
    },
  );
});

test("durable verification rejects tampering and expiry before persistence", async () => {
  const issuedAt = Date.UTC(2026, 6, 24, 10, 0, 0);
  const link = await createEmailMagicLink("person@example.com", origin, "/", secret, issuedAt);
  const token = new URL(link.verificationUrl).searchParams.get("token") as string;
  const [iv, ciphertext] = token.split(".");
  const replacement = ciphertext.endsWith("A") ? "B" : "A";
  const tampered = `${iv}.${ciphertext.slice(0, -1)}${replacement}`;
  await assert.rejects(verifyDurableEmailMagicLink(tampered, secret, issuedAt + 1_000));
  await assert.rejects(
    verifyDurableEmailMagicLink(token, secret, issuedAt + 601_000),
    /email_magic_link_expired/,
  );
});

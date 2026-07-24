import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_DELIVERY_PROFILE,
  sendEmailMagicLink,
} from "../app/email-magic-link-delivery.ts";

const config = {
  apiKey: "re_test_key_not_for_production",
  fromAddress: "Celestial ASTRO AI <login@example.com>",
  secret: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG",
};
const verificationUrl =
  "https://cosmicsphere-staging.example.workers.dev/api/auth/email/verify?token=abc.def";
const fingerprint = "a".repeat(43);

test("Resend delivery sends only the required magic-link message and returns provider ID", async () => {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), EMAIL_DELIVERY_PROFILE.endpoint);
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "manual");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), `Bearer ${config.apiKey}`);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("idempotency-key"), `celestial-magic-${fingerprint}`);
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(payload.from, config.fromAddress);
    assert.deepEqual(payload.to, ["person@example.com"]);
    assert.match(String(payload.subject), /sign-in link/i);
    assert.match(String(payload.html), /Verify email and continue/);
    assert.match(String(payload.html), /same browser/i);
    assert.match(String(payload.text), /same browser/i);
    assert.match(String(payload.text), /api\/auth\/email\/verify/);
    return Response.json({ id: "resend-message-123" });
  }) as typeof fetch;

  assert.deepEqual(
    await sendEmailMagicLink(
      config,
      "Person@Example.com",
      verificationUrl,
      fingerprint,
      fetchImpl,
    ),
    { provider: "Resend", messageId: "resend-message-123" },
  );
});

test("Resend delivery maps network and provider failures to safe codes", async () => {
  const unreachable = (async () => {
    throw new Error("private network detail");
  }) as typeof fetch;
  await assert.rejects(
    sendEmailMagicLink(config, "person@example.com", verificationUrl, fingerprint, unreachable),
    /email_delivery_unreachable/,
  );

  const rejected = (async () => new Response("provider secret detail", { status: 403 })) as typeof fetch;
  await assert.rejects(
    sendEmailMagicLink(config, "person@example.com", verificationUrl, fingerprint, rejected),
    /email_delivery_provider_rejected/,
  );

  const redirected = (async () =>
    new Response(null, { status: 302, headers: { Location: "https://other.example/" } })) as typeof fetch;
  await assert.rejects(
    sendEmailMagicLink(config, "person@example.com", verificationUrl, fingerprint, redirected),
    /email_delivery_redirect_rejected/,
  );
});

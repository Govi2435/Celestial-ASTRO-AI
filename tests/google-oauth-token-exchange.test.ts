import assert from "node:assert/strict";
import test from "node:test";
import { GOOGLE_OAUTH_PROFILE } from "../app/google-oauth.ts";
import { exchangeGoogleAuthorizationCodeAtEdge } from "../app/google-oauth-token-exchange.ts";

const config = {
  clientId: "celestial-test.apps.googleusercontent.com",
  clientSecret: "test-client-secret-not-for-production",
  cookieSecret: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG",
};
const redirectUri = "https://cosmicsphere-staging.example.workers.dev/api/auth/google/callback";
const verifier = "v".repeat(64);

test("edge token exchange sends a string form body and rejects redirects manually", async () => {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), GOOGLE_OAUTH_PROFILE.tokenEndpoint);
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "manual");
    assert.equal(typeof init?.body, "string");
    assert.equal(
      new Headers(init?.headers).get("content-type"),
      "application/x-www-form-urlencoded;charset=UTF-8",
    );

    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("client_id"), config.clientId);
    assert.equal(body.get("client_secret"), config.clientSecret);
    assert.equal(body.get("code"), "authorization-code");
    assert.equal(body.get("code_verifier"), verifier);
    assert.equal(body.get("redirect_uri"), redirectUri);
    assert.equal(body.get("grant_type"), "authorization_code");

    return Response.json({
      id_token: "header.payload.signature",
      access_token: "must-never-be-returned",
      refresh_token: "must-never-be-returned",
    });
  }) as typeof fetch;

  assert.deepEqual(
    await exchangeGoogleAuthorizationCodeAtEdge(
      config,
      "authorization-code",
      verifier,
      redirectUri,
      fetchImpl,
    ),
    { idToken: "header.payload.signature" },
  );
});

test("edge token exchange converts outbound fetch failures into a safe diagnostic", async () => {
  const fetchImpl = (async () => {
    throw new TypeError("network details must not escape");
  }) as typeof fetch;

  await assert.rejects(
    exchangeGoogleAuthorizationCodeAtEdge(
      config,
      "authorization-code",
      verifier,
      redirectUri,
      fetchImpl,
    ),
    /google_token_endpoint_unreachable/,
  );
});

test("edge token exchange maps provider failures without exposing provider bodies", async () => {
  for (const [providerCode, expected] of [
    ["invalid_client", /google_token_client_rejected/],
    ["invalid_grant", /google_authorization_code_rejected/],
    ["redirect_uri_mismatch", /google_redirect_uri_rejected/],
  ] as const) {
    const fetchImpl = (async () =>
      Response.json(
        { error: providerCode, error_description: "sensitive provider detail" },
        { status: 400 },
      )) as typeof fetch;

    await assert.rejects(
      exchangeGoogleAuthorizationCodeAtEdge(
        config,
        "authorization-code",
        verifier,
        redirectUri,
        fetchImpl,
      ),
      expected,
    );
  }
});

test("edge token exchange rejects provider redirects", async () => {
  const fetchImpl = (async () =>
    new Response(null, {
      status: 302,
      headers: { Location: "https://example.invalid/should-not-follow" },
    })) as typeof fetch;

  await assert.rejects(
    exchangeGoogleAuthorizationCodeAtEdge(
      config,
      "authorization-code",
      verifier,
      redirectUri,
      fetchImpl,
    ),
    /google_token_endpoint_redirected/,
  );
});

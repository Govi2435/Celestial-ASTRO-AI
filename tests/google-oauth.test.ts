import assert from "node:assert/strict";
import test from "node:test";
import {
  GOOGLE_OAUTH_PROFILE,
  createGoogleAuthorizationRequest,
  exchangeGoogleAuthorizationCode,
  parseGoogleOAuthCookie,
  verifyGoogleIdToken,
  verifyGoogleOAuthTransaction,
} from "../app/google-oauth.ts";

const config = {
  clientId: "celestial-test.apps.googleusercontent.com",
  clientSecret: "test-client-secret-not-for-production",
  cookieSecret: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG",
};
const redirectUri = "https://cosmicsphere-staging.example.workers.dev/api/auth/google/callback";

function cookieValue(setCookie: string) {
  const pair = setCookie.split(";", 1)[0];
  return pair.slice(pair.indexOf("=") + 1);
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function createJwtFixture(overrides: Record<string, unknown> = {}) {
  const keyPair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const publicJwk = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey & {
    kid?: string;
    use?: string;
    alg?: string;
  };
  publicJwk.kid = "google-test-key";
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";

  const now = 1_800_000_000;
  const claims = {
    iss: "https://accounts.google.com",
    aud: config.clientId,
    sub: "google-subject-123",
    email: "person@example.com",
    email_verified: true,
    name: "Example Person",
    picture: "https://example.com/avatar.png",
    nonce: "nonce_nonce_nonce_nonce_nonce_1234",
    iat: now - 30,
    exp: now + 300,
    ...overrides,
  };
  const header = { alg: "RS256", typ: "JWT", kid: publicJwk.kid };
  const signingInput = `${encodeJson(header)}.${encodeJson(claims)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return {
    idToken: `${signingInput}.${Buffer.from(signature).toString("base64url")}`,
    publicJwk,
    now,
    nonce: claims.nonce as string,
  };
}

function jwksFetch(publicJwk: JsonWebKey): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    assert.equal(String(input), GOOGLE_OAUTH_PROFILE.jwksEndpoint);
    return Response.json({ keys: [publicJwk] });
  }) as typeof fetch;
}

test("authorization request binds state, nonce, PKCE and a signed host-only cookie", async () => {
  const issuedAt = Date.UTC(2026, 6, 24, 8, 0, 0);
  const request = await createGoogleAuthorizationRequest(
    config,
    redirectUri,
    "/account/sessions?source=google",
    issuedAt,
  );
  const url = new URL(request.authorizationUrl);

  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.pathname, "/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), config.clientId);
  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "openid email profile");
  assert.equal(url.searchParams.get("state"), request.transaction.state);
  assert.equal(url.searchParams.get("nonce"), request.transaction.nonce);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("access_type"), "online");
  assert.equal(url.searchParams.get("prompt"), "select_account");
  assert.ok((url.searchParams.get("code_challenge") ?? "").length === 43);

  assert.match(request.cookie, /^__Host-celestial_google_oauth=/);
  assert.match(request.cookie, /; Path=\//);
  assert.match(request.cookie, /; HttpOnly/);
  assert.match(request.cookie, /; Secure/);
  assert.match(request.cookie, /; SameSite=Lax/);
  assert.match(request.cookie, /; Max-Age=600/);
  assert.doesNotMatch(request.cookie, /Domain=/i);
  assert.ok(parseGoogleOAuthCookie(request.cookie));

  const verified = await verifyGoogleOAuthTransaction(
    cookieValue(request.cookie),
    config.cookieSecret,
    issuedAt + 30_000,
  );
  assert.equal(verified.state, request.transaction.state);
  assert.equal(verified.nonce, request.transaction.nonce);
  assert.equal(verified.returnTo, "/account/sessions?source=google");
});

test("transaction cookie rejects tampering and expiry", async () => {
  const issuedAt = Date.UTC(2026, 6, 24, 8, 0, 0);
  const request = await createGoogleAuthorizationRequest(config, redirectUri, "/", issuedAt);
  const signed = cookieValue(request.cookie);
  const replacement = signed.endsWith("A") ? "B" : "A";
  const tampered = `${signed.slice(0, -1)}${replacement}`;

  await assert.rejects(
    verifyGoogleOAuthTransaction(tampered, config.cookieSecret, issuedAt + 1_000),
    /oauth_transaction_invalid/,
  );
  await assert.rejects(
    verifyGoogleOAuthTransaction(signed, config.cookieSecret, issuedAt + 601_000),
    /oauth_transaction_expired/,
  );
});

test("authorization-code exchange sends confidential values only to Google and returns no access token", async () => {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), GOOGLE_OAUTH_PROFILE.tokenEndpoint);
    assert.equal(init?.method, "POST");
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("client_id"), config.clientId);
    assert.equal(body.get("client_secret"), config.clientSecret);
    assert.equal(body.get("code"), "authorization-code");
    assert.equal(body.get("code_verifier"), "v".repeat(64));
    assert.equal(body.get("redirect_uri"), redirectUri);
    assert.equal(body.get("grant_type"), "authorization_code");
    return Response.json({
      id_token: "header.payload.signature",
      access_token: "must-never-be-returned",
      refresh_token: "must-never-be-returned",
    });
  }) as typeof fetch;

  assert.deepEqual(
    await exchangeGoogleAuthorizationCode(
      config,
      "authorization-code",
      "v".repeat(64),
      redirectUri,
      fetchImpl,
    ),
    { idToken: "header.payload.signature" },
  );
});

test("Google ID token verifies signature and required identity claims", async () => {
  const fixture = await createJwtFixture();
  const identity = await verifyGoogleIdToken(fixture.idToken, {
    clientId: config.clientId,
    nonce: fixture.nonce,
    now: fixture.now * 1000,
    fetchImpl: jwksFetch(fixture.publicJwk),
  });

  assert.deepEqual(identity, {
    provider: "google",
    subject: "google-subject-123",
    email: "person@example.com",
    emailVerified: true,
    displayName: "Example Person",
    pictureUrl: "https://example.com/avatar.png",
  });
});

test("Google ID token rejects nonce, audience, expiry and unverified email failures", async () => {
  for (const [overrides, expected] of [
    [{ nonce: "different_nonce_value_1234567890" }, /google_id_token_nonce_invalid/],
    [{ aud: "another-client.apps.googleusercontent.com" }, /google_id_token_audience_invalid/],
    [{ exp: 1_799_999_000 }, /google_id_token_expired/],
    [{ email_verified: false }, /google_email_not_verified/],
  ] as const) {
    const fixture = await createJwtFixture(overrides);
    await assert.rejects(
      verifyGoogleIdToken(fixture.idToken, {
        clientId: config.clientId,
        nonce: "nonce_nonce_nonce_nonce_nonce_1234",
        now: fixture.now * 1000,
        fetchImpl: jwksFetch(fixture.publicJwk),
      }),
      expected,
    );
  }
});

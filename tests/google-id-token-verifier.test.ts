import assert from "node:assert/strict";
import test from "node:test";
import { GOOGLE_OAUTH_PROFILE } from "../app/google-oauth.ts";
import { verifyGoogleIdTokenAtEdge } from "../app/google-id-token-verifier.ts";

const clientId = "celestial-test.apps.googleusercontent.com";
const nonce = "nonce_nonce_nonce_nonce_nonce_1234";

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
    key_ops?: string[];
  };
  publicJwk.kid = "google-edge-test-key";
  publicJwk.use = "sig";
  publicJwk.alg = "RS256";
  publicJwk.key_ops = ["verify"];

  const now = 1_800_000_000;
  const claims = {
    iss: "https://accounts.google.com",
    aud: clientId,
    sub: "google-subject-edge-123",
    email: "edge@example.com",
    email_verified: true,
    name: "Edge Example",
    picture: "https://example.com/edge.png",
    nonce,
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
  };
}

test("Workers-safe verifier fetches JWKS without following redirects and verifies identity", async () => {
  const fixture = await createJwtFixture();
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(input), GOOGLE_OAUTH_PROFILE.jwksEndpoint);
    assert.equal(init?.method, "GET");
    assert.equal(init?.redirect, "manual");
    assert.equal(new Headers(init?.headers).get("accept"), "application/json");
    return Response.json({ keys: [fixture.publicJwk] });
  }) as typeof fetch;

  const identity = await verifyGoogleIdTokenAtEdge(fixture.idToken, {
    clientId,
    nonce,
    now: fixture.now * 1000,
    fetchImpl,
  });

  assert.deepEqual(identity, {
    provider: "google",
    subject: "google-subject-edge-123",
    email: "edge@example.com",
    emailVerified: true,
    displayName: "Edge Example",
    pictureUrl: "https://example.com/edge.png",
  });
});

test("Workers-safe verifier maps JWKS network failures", async () => {
  const fixture = await createJwtFixture();
  const fetchImpl = (async () => {
    throw new TypeError("network unavailable");
  }) as typeof fetch;

  await assert.rejects(
    verifyGoogleIdTokenAtEdge(fixture.idToken, {
      clientId,
      nonce,
      now: fixture.now * 1000,
      fetchImpl,
    }),
    /google_jwks_unreachable/,
  );
});

test("Workers-safe verifier rejects JWKS redirects without following them", async () => {
  const fixture = await createJwtFixture();
  const fetchImpl = (async () =>
    new Response(null, {
      status: 302,
      headers: { Location: "https://unexpected.example/jwks" },
    })) as typeof fetch;

  await assert.rejects(
    verifyGoogleIdTokenAtEdge(fixture.idToken, {
      clientId,
      nonce,
      now: fixture.now * 1000,
      fetchImpl,
    }),
    /google_jwks_redirect_rejected/,
  );
});

test("Workers-safe verifier rejects unusable provider keys", async () => {
  const fixture = await createJwtFixture();
  const fetchImpl = (async () =>
    Response.json({
      keys: [{ ...fixture.publicJwk, key_ops: ["sign"] }],
    })) as typeof fetch;

  await assert.rejects(
    verifyGoogleIdTokenAtEdge(fixture.idToken, {
      clientId,
      nonce,
      now: fixture.now * 1000,
      fetchImpl,
    }),
    /google_id_token_key_invalid/,
  );
});

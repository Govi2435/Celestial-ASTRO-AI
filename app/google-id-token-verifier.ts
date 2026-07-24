import {
  GOOGLE_OAUTH_PROFILE,
  GoogleOAuthError,
  type FetchLike,
  type VerifiedGoogleIdentity,
} from "./google-oauth.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

type ParsedJwt = {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  signingInput: Uint8Array<ArrayBuffer>;
  signature: Uint8Array<ArrayBuffer>;
};

type GoogleJwk = JsonWebKey & {
  kid?: unknown;
  use?: unknown;
  alg?: unknown;
  key_ops?: unknown;
  n?: unknown;
  e?: unknown;
};

function assertBoundedText(value: unknown, code: string, max: number) {
  if (typeof value !== "string") throw new GoogleOAuthError(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new GoogleOAuthError(code);
  return normalized;
}

function assertBase64UrlToken(value: unknown, code: string, min = 22, max = 128) {
  const token = assertBoundedText(value, code, max);
  if (token.length < min || !BASE64URL_PATTERN.test(token)) {
    throw new GoogleOAuthError(code);
  }
  return token;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!BASE64URL_PATTERN.test(value)) throw new GoogleOAuthError("google_id_token_invalid");
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new GoogleOAuthError("google_id_token_invalid");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(textDecoder.decode(base64UrlToBytes(value)));
  } catch (error) {
    if (error instanceof GoogleOAuthError) throw error;
    throw new GoogleOAuthError("google_id_token_invalid");
  }
}

function parseJwt(jwtInput: unknown): ParsedJwt {
  const jwt = assertBoundedText(jwtInput, "google_id_token_invalid", 16_384);
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new GoogleOAuthError("google_id_token_invalid");

  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature) {
    throw new GoogleOAuthError("google_id_token_invalid");
  }

  const header = decodeJson(encodedHeader);
  const claims = decodeJson(encodedClaims);
  if (
    typeof header !== "object" ||
    header === null ||
    typeof claims !== "object" ||
    claims === null
  ) {
    throw new GoogleOAuthError("google_id_token_invalid");
  }

  return {
    header: header as Record<string, unknown>,
    claims: claims as Record<string, unknown>,
    signingInput: textEncoder.encode(`${encodedHeader}.${encodedClaims}`),
    signature: base64UrlToBytes(encodedSignature),
  };
}

function audienceIncludes(audience: unknown, clientId: string) {
  if (typeof audience === "string") return audience === clientId;
  return (
    Array.isArray(audience) &&
    audience.every((item) => typeof item === "string") &&
    audience.includes(clientId)
  );
}

function validatePicture(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function fetchGoogleJwks(fetchImpl: FetchLike) {
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_OAUTH_PROFILE.jwksEndpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
    });
  } catch {
    throw new GoogleOAuthError("google_jwks_unreachable", 502);
  }

  if (response.status >= 300 && response.status < 400) {
    throw new GoogleOAuthError("google_jwks_redirect_rejected", 502);
  }
  if (!response.ok) throw new GoogleOAuthError("google_jwks_unavailable", 502);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GoogleOAuthError("google_jwks_invalid", 502);
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !Array.isArray((payload as { keys?: unknown }).keys)
  ) {
    throw new GoogleOAuthError("google_jwks_invalid", 502);
  }

  return (payload as { keys: GoogleJwk[] }).keys;
}

function selectRsaVerificationKey(keys: GoogleJwk[], kid: string): JsonWebKey {
  const candidate = keys.find((key) => {
    const keyOpsValid =
      key.key_ops === undefined ||
      (Array.isArray(key.key_ops) && key.key_ops.includes("verify"));
    return (
      key.kid === kid &&
      key.kty === "RSA" &&
      typeof key.n === "string" &&
      typeof key.e === "string" &&
      (key.use === undefined || key.use === "sig") &&
      (key.alg === undefined || key.alg === "RS256") &&
      keyOpsValid
    );
  });

  if (!candidate || typeof candidate.n !== "string" || typeof candidate.e !== "string") {
    throw new GoogleOAuthError("google_id_token_key_invalid");
  }

  // Normalize the provider key before WebCrypto import. Cloudflare Workers only
  // needs the RSA modulus and exponent; provider metadata is validated above.
  return {
    kty: "RSA",
    n: candidate.n,
    e: candidate.e,
    ext: true,
  };
}

async function verifySignature(
  key: JsonWebKey,
  signature: Uint8Array<ArrayBuffer>,
  signingInput: Uint8Array<ArrayBuffer>,
) {
  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    throw new GoogleOAuthError("google_id_token_key_import_failed", 502);
  }

  try {
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signature,
      signingInput,
    );
  } catch {
    throw new GoogleOAuthError("google_id_token_signature_check_failed", 502);
  }
}

export async function verifyGoogleIdTokenAtEdge(
  idToken: string,
  options: {
    clientId: string;
    nonce: string;
    now?: number;
    fetchImpl?: FetchLike;
  },
): Promise<VerifiedGoogleIdentity> {
  const clientId = assertBoundedText(options.clientId, "google_client_id_invalid", 512);
  const expectedNonce = assertBase64UrlToken(options.nonce, "oauth_nonce_invalid");
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const parsed = parseJwt(idToken);

  if (parsed.header.alg !== "RS256") {
    throw new GoogleOAuthError("google_id_token_algorithm_invalid");
  }
  const kid = assertBoundedText(parsed.header.kid, "google_id_token_key_invalid", 256);
  const keys = await fetchGoogleJwks(options.fetchImpl ?? fetch);
  const key = selectRsaVerificationKey(keys, kid);
  const signatureValid = await verifySignature(key, parsed.signature, parsed.signingInput);
  if (!signatureValid) throw new GoogleOAuthError("google_id_token_signature_invalid");

  const claims = parsed.claims;
  if (typeof claims.iss !== "string" || !GOOGLE_ISSUERS.has(claims.iss)) {
    throw new GoogleOAuthError("google_id_token_issuer_invalid");
  }
  if (!audienceIncludes(claims.aud, clientId)) {
    throw new GoogleOAuthError("google_id_token_audience_invalid");
  }
  if (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) {
    throw new GoogleOAuthError("google_id_token_authorized_party_invalid");
  }

  const skew = GOOGLE_OAUTH_PROFILE.clockSkewSeconds;
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds - skew) {
    throw new GoogleOAuthError("google_id_token_expired");
  }
  if (typeof claims.iat !== "number" || claims.iat > nowSeconds + skew) {
    throw new GoogleOAuthError("google_id_token_issued_at_invalid");
  }
  if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + skew) {
    throw new GoogleOAuthError("google_id_token_not_active");
  }
  if (claims.nonce !== expectedNonce) {
    throw new GoogleOAuthError("google_id_token_nonce_invalid");
  }

  const subject = assertBoundedText(claims.sub, "google_subject_invalid", 255);
  const email = assertBoundedText(claims.email, "google_email_invalid", 320).toLowerCase();
  if (claims.email_verified !== true) {
    throw new GoogleOAuthError("google_email_not_verified");
  }

  const displayName =
    typeof claims.name === "string" && claims.name.trim() && claims.name.length <= 200
      ? claims.name.trim()
      : email.split("@", 1)[0];

  return {
    provider: "google",
    subject,
    email,
    emailVerified: true,
    displayName,
    pictureUrl: validatePicture(claims.picture),
  };
}

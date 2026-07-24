import {
  createPkcePair,
  randomBase64Url,
  sanitizeReturnTo,
} from "./auth-compatibility.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export const GOOGLE_OAUTH_PROFILE = {
  id: "celestial-google-oauth-v1",
  phase: "P9-C",
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  jwksEndpoint: "https://www.googleapis.com/oauth2/v3/certs",
  scopes: ["openid", "email", "profile"],
  transactionCookieName: "__Host-celestial_google_oauth",
  transactionMaxAgeSeconds: 600,
  clockSkewSeconds: 60,
  productionAuthentication: false,
} as const;

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  cookieSecret: string;
};

export type GoogleOAuthTransaction = {
  version: 1;
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  issuedAt: number;
};

export type VerifiedGoogleIdentity = {
  provider: "google";
  subject: string;
  email: string;
  emailVerified: true;
  displayName: string;
  pictureUrl: string | null;
};

export class GoogleOAuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "GoogleOAuthError";
    this.code = code;
    this.status = status;
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string) {
  if (!BASE64URL_PATTERN.test(value)) throw new GoogleOAuthError("invalid_base64url");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new GoogleOAuthError("invalid_base64url");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function encodeJson(value: unknown) {
  return bytesToBase64Url(textEncoder.encode(JSON.stringify(value)));
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(textDecoder.decode(base64UrlToBytes(value)));
  } catch (error) {
    if (error instanceof GoogleOAuthError) throw error;
    throw new GoogleOAuthError("invalid_json_payload");
  }
}

function assertBoundedText(value: unknown, code: string, max: number) {
  if (typeof value !== "string") throw new GoogleOAuthError(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new GoogleOAuthError(code);
  return normalized;
}

function assertBase64UrlToken(value: unknown, code: string, min = 22, max = 128) {
  const token = assertBoundedText(value, code, max);
  if (token.length < min || !BASE64URL_PATTERN.test(token)) throw new GoogleOAuthError(code);
  return token;
}

function validateConfig(config: GoogleOAuthConfig) {
  const clientId = assertBoundedText(config.clientId, "google_client_id_invalid", 512);
  const clientSecret = assertBoundedText(config.clientSecret, "google_client_secret_invalid", 512);
  const cookieSecret = assertBoundedText(config.cookieSecret, "google_cookie_secret_invalid", 512);
  if (textEncoder.encode(cookieSecret).length < 32) {
    throw new GoogleOAuthError("google_cookie_secret_too_short", 500);
  }
  return { clientId, clientSecret, cookieSecret };
}

async function importHmacKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

export async function signGoogleOAuthTransaction(
  transaction: GoogleOAuthTransaction,
  cookieSecret: string,
) {
  validateGoogleOAuthTransaction(transaction);
  if (textEncoder.encode(cookieSecret).length < 32) {
    throw new GoogleOAuthError("google_cookie_secret_too_short", 500);
  }
  const payload = encodeJson(transaction);
  const key = await importHmacKey(cookieSecret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyGoogleOAuthTransaction(
  signedValue: string,
  cookieSecret: string,
  now = Date.now(),
) {
  if (signedValue.length > 4096) throw new GoogleOAuthError("oauth_transaction_invalid");
  const parts = signedValue.split(".");
  if (parts.length !== 2) throw new GoogleOAuthError("oauth_transaction_invalid");
  const [payload, signature] = parts;
  if (!payload || !signature || !BASE64URL_PATTERN.test(payload) || !BASE64URL_PATTERN.test(signature)) {
    throw new GoogleOAuthError("oauth_transaction_invalid");
  }

  const key = await importHmacKey(cookieSecret, ["verify"]);
  const verified = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signature),
    textEncoder.encode(payload),
  );
  if (!verified) throw new GoogleOAuthError("oauth_transaction_invalid");

  const transaction = validateGoogleOAuthTransaction(decodeJson(payload));
  const age = now - transaction.issuedAt;
  const maxAge = GOOGLE_OAUTH_PROFILE.transactionMaxAgeSeconds * 1000;
  const futureSkew = GOOGLE_OAUTH_PROFILE.clockSkewSeconds * 1000;
  if (age < -futureSkew || age > maxAge) throw new GoogleOAuthError("oauth_transaction_expired");
  return transaction;
}

export function validateGoogleOAuthTransaction(value: unknown): GoogleOAuthTransaction {
  if (typeof value !== "object" || value === null) throw new GoogleOAuthError("oauth_transaction_invalid");
  const input = value as Record<string, unknown>;
  if (input.version !== 1) throw new GoogleOAuthError("oauth_transaction_invalid");
  if (!Number.isSafeInteger(input.issuedAt) || (input.issuedAt as number) <= 0) {
    throw new GoogleOAuthError("oauth_transaction_invalid");
  }
  return {
    version: 1,
    state: assertBase64UrlToken(input.state, "oauth_state_invalid"),
    nonce: assertBase64UrlToken(input.nonce, "oauth_nonce_invalid"),
    codeVerifier: assertBase64UrlToken(input.codeVerifier, "oauth_code_verifier_invalid", 43, 128),
    returnTo: sanitizeReturnTo(input.returnTo, "/"),
    issuedAt: input.issuedAt as number,
  };
}

export function serializeGoogleOAuthCookie(value: string) {
  if (value.length > 4096 || !/^[A-Za-z0-9_.-]+$/u.test(value)) {
    throw new GoogleOAuthError("oauth_transaction_invalid");
  }
  return [
    `${GOOGLE_OAUTH_PROFILE.transactionCookieName}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${GOOGLE_OAUTH_PROFILE.transactionMaxAgeSeconds}`,
  ].join("; ");
}

export function clearGoogleOAuthCookie() {
  return [
    `${GOOGLE_OAUTH_PROFILE.transactionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export function parseGoogleOAuthCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    if (name !== GOOGLE_OAUTH_PROFILE.transactionCookieName) continue;
    const value = entry.slice(separator + 1).trim();
    return value && value.length <= 4096 ? value : null;
  }
  return null;
}

function validateRedirectUri(redirectUri: string) {
  const url = new URL(redirectUri);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new GoogleOAuthError("google_redirect_uri_invalid", 500);
  }
  return url.toString();
}

export async function createGoogleAuthorizationRequest(
  configInput: GoogleOAuthConfig,
  redirectUriInput: string,
  returnToInput: unknown,
  now = Date.now(),
) {
  const config = validateConfig(configInput);
  const redirectUri = validateRedirectUri(redirectUriInput);
  const pkce = await createPkcePair();
  const transaction: GoogleOAuthTransaction = {
    version: 1,
    state: randomBase64Url(32),
    nonce: randomBase64Url(32),
    codeVerifier: pkce.verifier,
    returnTo: sanitizeReturnTo(returnToInput, "/"),
    issuedAt: now,
  };
  const signedTransaction = await signGoogleOAuthTransaction(transaction, config.cookieSecret);

  const authorizationUrl = new URL(GOOGLE_OAUTH_PROFILE.authorizationEndpoint);
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", GOOGLE_OAUTH_PROFILE.scopes.join(" "));
  authorizationUrl.searchParams.set("state", transaction.state);
  authorizationUrl.searchParams.set("nonce", transaction.nonce);
  authorizationUrl.searchParams.set("code_challenge", pkce.challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("access_type", "online");
  authorizationUrl.searchParams.set("prompt", "select_account");

  return {
    authorizationUrl: authorizationUrl.toString(),
    transaction,
    cookie: serializeGoogleOAuthCookie(signedTransaction),
  };
}

export async function exchangeGoogleAuthorizationCode(
  configInput: GoogleOAuthConfig,
  codeInput: unknown,
  codeVerifierInput: unknown,
  redirectUriInput: string,
  fetchImpl: typeof fetch = fetch,
) {
  const config = validateConfig(configInput);
  const code = assertBoundedText(codeInput, "authorization_code_invalid", 4096);
  const codeVerifier = assertBase64UrlToken(
    codeVerifierInput,
    "oauth_code_verifier_invalid",
    43,
    128,
  );
  const redirectUri = validateRedirectUri(redirectUriInput);

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetchImpl(GOOGLE_OAUTH_PROFILE.tokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    redirect: "error",
  });
  if (!response.ok) throw new GoogleOAuthError("google_token_exchange_failed", 502);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GoogleOAuthError("google_token_response_invalid", 502);
  }
  if (typeof payload !== "object" || payload === null) {
    throw new GoogleOAuthError("google_token_response_invalid", 502);
  }
  const idToken = assertBoundedText(
    (payload as Record<string, unknown>).id_token,
    "google_id_token_missing",
    16_384,
  );
  return { idToken };
}

type ParsedJwt = {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  signingInput: Uint8Array;
  signature: Uint8Array;
};

function parseJwt(jwt: string): ParsedJwt {
  if (jwt.length > 16_384) throw new GoogleOAuthError("google_id_token_invalid");
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new GoogleOAuthError("google_id_token_invalid");
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  if (!encodedHeader || !encodedClaims || !encodedSignature) {
    throw new GoogleOAuthError("google_id_token_invalid");
  }
  const header = decodeJson(encodedHeader);
  const claims = decodeJson(encodedClaims);
  if (typeof header !== "object" || header === null || typeof claims !== "object" || claims === null) {
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
  return Array.isArray(audience) && audience.every((item) => typeof item === "string") && audience.includes(clientId);
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

export async function verifyGoogleIdToken(
  idToken: string,
  options: {
    clientId: string;
    nonce: string;
    now?: number;
    fetchImpl?: typeof fetch;
  },
): Promise<VerifiedGoogleIdentity> {
  const clientId = assertBoundedText(options.clientId, "google_client_id_invalid", 512);
  const expectedNonce = assertBase64UrlToken(options.nonce, "oauth_nonce_invalid");
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const parsed = parseJwt(idToken);

  if (parsed.header.alg !== "RS256") throw new GoogleOAuthError("google_id_token_algorithm_invalid");
  const kid = assertBoundedText(parsed.header.kid, "google_id_token_key_invalid", 256);

  const jwksResponse = await fetchImpl(GOOGLE_OAUTH_PROFILE.jwksEndpoint, {
    headers: { Accept: "application/json" },
    redirect: "error",
  });
  if (!jwksResponse.ok) throw new GoogleOAuthError("google_jwks_unavailable", 502);
  let jwks: unknown;
  try {
    jwks = await jwksResponse.json();
  } catch {
    throw new GoogleOAuthError("google_jwks_invalid", 502);
  }
  if (typeof jwks !== "object" || jwks === null || !Array.isArray((jwks as { keys?: unknown }).keys)) {
    throw new GoogleOAuthError("google_jwks_invalid", 502);
  }
  const key = (jwks as { keys: JsonWebKey[] }).keys.find((candidate) => {
    const value = candidate as JsonWebKey & { kid?: string; use?: string; alg?: string; key_ops?: string[] };
    return (
      value.kid === kid &&
      value.kty === "RSA" &&
      (value.use === undefined || value.use === "sig") &&
      (value.alg === undefined || value.alg === "RS256") &&
      (value.key_ops === undefined || value.key_ops.includes("verify"))
    );
  });
  if (!key) throw new GoogleOAuthError("google_id_token_key_invalid");

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
    throw new GoogleOAuthError("google_id_token_key_invalid");
  }
  const signatureValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    parsed.signature,
    parsed.signingInput,
  );
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
  if (claims.nonce !== expectedNonce) throw new GoogleOAuthError("google_id_token_nonce_invalid");

  const subject = assertBoundedText(claims.sub, "google_subject_invalid", 255);
  const email = assertBoundedText(claims.email, "google_email_invalid", 320).toLowerCase();
  if (claims.email_verified !== true) throw new GoogleOAuthError("google_email_not_verified");
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

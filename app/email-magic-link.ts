import {
  randomBase64Url,
  sanitizeReturnTo,
  sha256Base64Url,
} from "./auth-compatibility.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const SIGNED_VALUE_PATTERN = /^[A-Za-z0-9_.-]+$/u;
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/u;
const TOKEN_AAD = textEncoder.encode("celestial-email-magic-link-v1");

export const EMAIL_MAGIC_LINK_PROFILE = {
  id: "celestial-email-magic-link-v1",
  phase: "P9-C",
  deliveryProvider: "resend-http-api",
  verifyPath: "/api/auth/email/verify",
  transactionCookieName: "__Host-celestial_email_magic",
  transactionMaxAgeSeconds: 600,
  sameBrowserRequired: true,
  durableConsumption: false,
  createsAccount: false,
  createsSession: false,
} as const;

export type EmailMagicLinkConfig = {
  apiKey: string;
  fromAddress: string;
  secret: string;
};

export type EmailMagicLinkIdentity = {
  provider: "email_magic_link";
  email: string;
  emailVerified: true;
  returnTo: string;
};

type LinkPayload = {
  version: 1;
  email: string;
  nonce: string;
  returnTo: string;
  issuedAt: number;
};

type BrowserTransaction = {
  version: 1;
  fingerprint: string;
  nonce: string;
  issuedAt: number;
};

export class EmailMagicLinkError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "EmailMagicLinkError";
    this.code = code;
    this.status = status;
  }
}

function bytesToBase64Url(bytes: Uint8Array<ArrayBufferLike>) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!value || !BASE64URL_PATTERN.test(value)) {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeJson(value: unknown) {
  return bytesToBase64Url(textEncoder.encode(JSON.stringify(value)));
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(textDecoder.decode(base64UrlToBytes(value)));
  } catch (error) {
    if (error instanceof EmailMagicLinkError) throw error;
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
}

function validateSecret(secretInput: unknown) {
  if (typeof secretInput !== "string" || textEncoder.encode(secretInput).length < 32) {
    throw new EmailMagicLinkError("email_magic_link_secret_invalid", 500);
  }
  if (secretInput.length > 512) {
    throw new EmailMagicLinkError("email_magic_link_secret_invalid", 500);
  }
  return secretInput;
}

export function normalizeMagicLinkEmail(value: unknown) {
  if (typeof value !== "string") throw new EmailMagicLinkError("email_invalid");
  const email = value.trim().toLowerCase();
  if (
    !email ||
    email.length > 320 ||
    /[\u0000-\u001f\u007f]/u.test(email) ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw new EmailMagicLinkError("email_invalid");
  }
  return email;
}

function validateIssuedAt(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  return value;
}

function validateAge(issuedAt: number, now: number) {
  const age = now - issuedAt;
  const maxAge = EMAIL_MAGIC_LINK_PROFILE.transactionMaxAgeSeconds * 1000;
  if (age < -60_000 || age > maxAge) {
    throw new EmailMagicLinkError("email_magic_link_expired");
  }
}

function validateLinkPayload(value: unknown): LinkPayload {
  if (typeof value !== "object" || value === null) {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  const input = value as Record<string, unknown>;
  if (input.version !== 1) throw new EmailMagicLinkError("email_magic_link_invalid");
  const nonce = typeof input.nonce === "string" ? input.nonce : "";
  if (nonce.length < 22 || nonce.length > 128 || !BASE64URL_PATTERN.test(nonce)) {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  return {
    version: 1,
    email: normalizeMagicLinkEmail(input.email),
    nonce,
    returnTo: sanitizeReturnTo(input.returnTo, "/"),
    issuedAt: validateIssuedAt(input.issuedAt),
  };
}

function validateBrowserTransaction(value: unknown): BrowserTransaction {
  if (typeof value !== "object" || value === null) {
    throw new EmailMagicLinkError("email_magic_transaction_invalid");
  }
  const input = value as Record<string, unknown>;
  if (input.version !== 1) throw new EmailMagicLinkError("email_magic_transaction_invalid");
  const fingerprint = typeof input.fingerprint === "string" ? input.fingerprint : "";
  const nonce = typeof input.nonce === "string" ? input.nonce : "";
  if (
    fingerprint.length !== 43 ||
    nonce.length < 22 ||
    nonce.length > 128 ||
    !BASE64URL_PATTERN.test(fingerprint) ||
    !BASE64URL_PATTERN.test(nonce)
  ) {
    throw new EmailMagicLinkError("email_magic_transaction_invalid");
  }
  return {
    version: 1,
    fingerprint,
    nonce,
    issuedAt: validateIssuedAt(input.issuedAt),
  };
}

async function deriveAesKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(validateSecret(secret)));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function importHmacKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(validateSecret(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function sealLinkPayload(payload: LinkPayload, secret: string) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await deriveAesKey(secret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: TOKEN_AAD, tagLength: 128 },
    key,
    textEncoder.encode(JSON.stringify(payload)),
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

async function openLinkPayload(token: string, secret: string) {
  if (token.length > 4096) throw new EmailMagicLinkError("email_magic_link_invalid");
  const parts = token.split(".");
  if (parts.length !== 2) throw new EmailMagicLinkError("email_magic_link_invalid");
  const [encodedIv, encodedCiphertext] = parts;
  if (!encodedIv || !encodedCiphertext) throw new EmailMagicLinkError("email_magic_link_invalid");
  const iv = base64UrlToBytes(encodedIv);
  if (iv.length !== 12) throw new EmailMagicLinkError("email_magic_link_invalid");
  const key = await deriveAesKey(secret);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: TOKEN_AAD, tagLength: 128 },
      key,
      base64UrlToBytes(encodedCiphertext),
    );
  } catch {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  try {
    return validateLinkPayload(JSON.parse(textDecoder.decode(plaintext)));
  } catch (error) {
    if (error instanceof EmailMagicLinkError) throw error;
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
}

async function signBrowserTransaction(transaction: BrowserTransaction, secret: string) {
  const payload = encodeJson(transaction);
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

async function verifyBrowserTransaction(signedValue: string, secret: string) {
  if (signedValue.length > 4096 || !SIGNED_VALUE_PATTERN.test(signedValue)) {
    throw new EmailMagicLinkError("email_magic_transaction_invalid");
  }
  const parts = signedValue.split(".");
  if (parts.length !== 2) throw new EmailMagicLinkError("email_magic_transaction_invalid");
  const [payload, signature] = parts;
  if (!payload || !signature) throw new EmailMagicLinkError("email_magic_transaction_invalid");
  const key = await importHmacKey(secret, ["verify"]);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signature),
    textEncoder.encode(payload),
  );
  if (!valid) throw new EmailMagicLinkError("email_magic_transaction_invalid");
  return validateBrowserTransaction(decodeJson(payload));
}

export function serializeEmailMagicCookie(value: string) {
  if (!value || value.length > 4096 || !SIGNED_VALUE_PATTERN.test(value)) {
    throw new EmailMagicLinkError("email_magic_transaction_invalid");
  }
  return [
    `${EMAIL_MAGIC_LINK_PROFILE.transactionCookieName}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${EMAIL_MAGIC_LINK_PROFILE.transactionMaxAgeSeconds}`,
  ].join("; ");
}

export function clearEmailMagicCookie() {
  return [
    `${EMAIL_MAGIC_LINK_PROFILE.transactionCookieName}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export function parseEmailMagicCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() !== EMAIL_MAGIC_LINK_PROFILE.transactionCookieName) continue;
    const value = entry.slice(separator + 1).trim();
    return value && value.length <= 4096 && SIGNED_VALUE_PATTERN.test(value) ? value : null;
  }
  return null;
}

function validateOrigin(originInput: string) {
  const origin = new URL(originInput);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new EmailMagicLinkError("email_magic_origin_invalid", 500);
  }
  return origin.origin;
}

export async function createEmailMagicLink(
  emailInput: unknown,
  originInput: string,
  returnToInput: unknown,
  secret: string,
  now = Date.now(),
) {
  const email = normalizeMagicLinkEmail(emailInput);
  const origin = validateOrigin(originInput);
  const payload: LinkPayload = {
    version: 1,
    email,
    nonce: randomBase64Url(32),
    returnTo: sanitizeReturnTo(returnToInput, "/"),
    issuedAt: now,
  };
  const token = await sealLinkPayload(payload, secret);
  const fingerprint = await sha256Base64Url(token);
  const browserTransaction: BrowserTransaction = {
    version: 1,
    fingerprint,
    nonce: payload.nonce,
    issuedAt: now,
  };
  const signedTransaction = await signBrowserTransaction(browserTransaction, secret);
  const verificationUrl = new URL(EMAIL_MAGIC_LINK_PROFILE.verifyPath, origin);
  verificationUrl.searchParams.set("token", token);

  return {
    email,
    verificationUrl: verificationUrl.toString(),
    fingerprint,
    cookie: serializeEmailMagicCookie(signedTransaction),
    expiresInSeconds: EMAIL_MAGIC_LINK_PROFILE.transactionMaxAgeSeconds,
  };
}

export async function verifyEmailMagicLink(
  tokenInput: unknown,
  cookieValueInput: unknown,
  secret: string,
  now = Date.now(),
): Promise<EmailMagicLinkIdentity> {
  if (typeof tokenInput !== "string" || !tokenInput) {
    throw new EmailMagicLinkError("email_magic_link_missing");
  }
  if (typeof cookieValueInput !== "string" || !cookieValueInput) {
    throw new EmailMagicLinkError("email_magic_transaction_missing");
  }

  const transaction = await verifyBrowserTransaction(cookieValueInput, secret);
  validateAge(transaction.issuedAt, now);
  const payload = await openLinkPayload(tokenInput, secret);
  validateAge(payload.issuedAt, now);
  const fingerprint = await sha256Base64Url(tokenInput);

  if (
    fingerprint !== transaction.fingerprint ||
    payload.nonce !== transaction.nonce ||
    payload.issuedAt !== transaction.issuedAt
  ) {
    throw new EmailMagicLinkError("email_magic_transaction_mismatch");
  }

  return {
    provider: "email_magic_link",
    email: payload.email,
    emailVerified: true,
    returnTo: payload.returnTo,
  };
}

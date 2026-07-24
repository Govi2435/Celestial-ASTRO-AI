import { sanitizeReturnTo, sha256Base64Url } from "./auth-compatibility.ts";
import {
  EMAIL_MAGIC_LINK_PROFILE,
  EmailMagicLinkError,
  normalizeMagicLinkEmail,
  type EmailMagicLinkIdentity,
} from "./email-magic-link.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const TOKEN_AAD = textEncoder.encode("celestial-email-magic-link-v1");

type LinkPayload = {
  version: 1;
  email: string;
  nonce: string;
  returnTo: string;
  issuedAt: number;
};

export type DurableEmailMagicLinkVerification = EmailMagicLinkIdentity & {
  fingerprint: string;
  issuedAt: number;
  expiresAt: string;
};

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
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function validateSecret(secret: unknown) {
  if (typeof secret !== "string" || textEncoder.encode(secret).length < 32 || secret.length > 512) {
    throw new EmailMagicLinkError("email_magic_link_secret_invalid", 500);
  }
  return secret;
}

async function deriveAesKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(validateSecret(secret)));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["decrypt"]);
}

function validatePayload(value: unknown): LinkPayload {
  if (typeof value !== "object" || value === null) {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  const input = value as Record<string, unknown>;
  if (input.version !== 1) throw new EmailMagicLinkError("email_magic_link_invalid");
  const nonce = typeof input.nonce === "string" ? input.nonce : "";
  if (nonce.length < 22 || nonce.length > 128 || !BASE64URL_PATTERN.test(nonce)) {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  if (typeof input.issuedAt !== "number" || !Number.isSafeInteger(input.issuedAt) || input.issuedAt <= 0) {
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
  return {
    version: 1,
    email: normalizeMagicLinkEmail(input.email),
    nonce,
    returnTo: sanitizeReturnTo(input.returnTo, "/"),
    issuedAt: input.issuedAt,
  };
}

async function openPayload(token: string, secret: string) {
  if (!token || token.length > 4096) throw new EmailMagicLinkError("email_magic_link_invalid");
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
    return validatePayload(JSON.parse(textDecoder.decode(plaintext)));
  } catch (error) {
    if (error instanceof EmailMagicLinkError) throw error;
    throw new EmailMagicLinkError("email_magic_link_invalid");
  }
}

export async function verifyDurableEmailMagicLink(
  tokenInput: unknown,
  secret: string,
  now = Date.now(),
): Promise<DurableEmailMagicLinkVerification> {
  if (typeof tokenInput !== "string" || !tokenInput) {
    throw new EmailMagicLinkError("email_magic_link_missing");
  }
  const payload = await openPayload(tokenInput, secret);
  const age = now - payload.issuedAt;
  const maxAgeMs = EMAIL_MAGIC_LINK_PROFILE.transactionMaxAgeSeconds * 1000;
  if (age < -60_000 || age > maxAgeMs) throw new EmailMagicLinkError("email_magic_link_expired");
  return {
    provider: "email_magic_link",
    email: payload.email,
    emailVerified: true,
    returnTo: payload.returnTo,
    fingerprint: await sha256Base64Url(tokenInput),
    issuedAt: payload.issuedAt,
    expiresAt: new Date(payload.issuedAt + maxAgeMs).toISOString(),
  };
}

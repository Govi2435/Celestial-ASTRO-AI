const textEncoder = new TextEncoder();
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const RETURN_TO_ORIGIN = "https://celestial.invalid";

export const AUTH_COMPATIBILITY_PROFILE = {
  id: "celestial-vinext-auth-compatibility-v1",
  phase: "P9-C",
  runtime: "Vinext on Cloudflare Workers",
  cookieName: "__Host-celestial_auth_probe",
  cookieSameSite: "Lax",
  cookieMaxAgeSeconds: 300,
  productionAuthentication: false,
} as const;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function randomBase64Url(byteLength = 32) {
  if (!Number.isInteger(byteLength) || byteLength < 16 || byteLength > 96) {
    throw new Error("Token byte length must be an integer between 16 and 96.");
  }

  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function createPkcePair() {
  const verifier = randomBase64Url(48);
  return {
    verifier,
    challenge: await sha256Base64Url(verifier),
    method: "S256" as const,
  };
}

export function serializeCompatibilityCookie(value: string) {
  if (!BASE64URL_PATTERN.test(value) || value.length < 22 || value.length > 128) {
    throw new Error("Compatibility cookie value must be a bounded base64url token.");
  }

  return [
    `${AUTH_COMPATIBILITY_PROFILE.cookieName}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    `SameSite=${AUTH_COMPATIBILITY_PROFILE.cookieSameSite}`,
    `Max-Age=${AUTH_COMPATIBILITY_PROFILE.cookieMaxAgeSeconds}`,
  ].join("; ");
}

export function clearCompatibilityCookie() {
  return [
    `${AUTH_COMPATIBILITY_PROFILE.cookieName}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    `SameSite=${AUTH_COMPATIBILITY_PROFILE.cookieSameSite}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export function parseCompatibilityCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;

  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    if (name !== AUTH_COMPATIBILITY_PROFILE.cookieName) continue;
    const value = entry.slice(separator + 1).trim();
    return BASE64URL_PATTERN.test(value) ? value : null;
  }

  return null;
}

export function sanitizeReturnTo(value: unknown, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, RETURN_TO_ORIGIN);
    if (parsed.origin !== RETURN_TO_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

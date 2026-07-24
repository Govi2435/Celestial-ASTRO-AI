import { randomBase64Url } from "./auth-compatibility.ts";
import {
  parseServerSessionCookie,
  serverSessionCsrfToken,
} from "./server-session.ts";

const BASE64URL_TOKEN = /^[A-Za-z0-9_-]{43}$/u;

export const REQUEST_SECURITY_PROFILE = {
  id: "celestial-request-security-v1",
  sessionCsrfHeader: "x-celestial-csrf",
  anonymousCsrfCookieName: "__Host-celestial_email_csrf",
  anonymousCsrfFieldName: "csrfToken",
  anonymousCsrfLifetimeSeconds: 10 * 60,
} as const;

export class RequestSecurityError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 403) {
    super(code);
    this.name = "RequestSecurityError";
    this.code = code;
    this.status = status;
  }
}

function parseCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() !== name) continue;
    return entry.slice(separator + 1).trim();
  }
  return null;
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function assertCsrfToken(value: unknown, code: string) {
  if (typeof value !== "string" || !BASE64URL_TOKEN.test(value)) {
    throw new RequestSecurityError(code);
  }
  return value;
}

export function assertTrustedMutation(request: Request) {
  const requestUrl = new URL(request.url);
  if (requestUrl.protocol !== "https:") {
    throw new RequestSecurityError("request_https_required", 404);
  }

  const origin = request.headers.get("origin");
  if (origin !== requestUrl.origin) {
    throw new RequestSecurityError("request_origin_rejected");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) {
    throw new RequestSecurityError("request_site_rejected");
  }
}

export async function sessionCsrfTokenFromCookie(cookieHeader: string | null) {
  const sessionToken = parseServerSessionCookie(cookieHeader);
  if (!sessionToken) throw new RequestSecurityError("csrf_session_missing", 401);
  return serverSessionCsrfToken(sessionToken);
}

export async function assertSessionCsrf(request: Request) {
  assertTrustedMutation(request);
  const submitted = assertCsrfToken(
    request.headers.get(REQUEST_SECURITY_PROFILE.sessionCsrfHeader),
    "csrf_token_missing",
  );
  const expected = await sessionCsrfTokenFromCookie(request.headers.get("cookie"));
  if (!constantTimeEqual(submitted, expected)) {
    throw new RequestSecurityError("csrf_token_invalid");
  }
  return expected;
}

export function createAnonymousCsrfToken() {
  return randomBase64Url(32);
}

export function serializeAnonymousCsrfCookie(token: string) {
  assertCsrfToken(token, "csrf_token_invalid");
  return [
    `${REQUEST_SECURITY_PROFILE.anonymousCsrfCookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${REQUEST_SECURITY_PROFILE.anonymousCsrfLifetimeSeconds}`,
  ].join("; ");
}

export function clearAnonymousCsrfCookie() {
  return [
    `${REQUEST_SECURITY_PROFILE.anonymousCsrfCookieName}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export function assertAnonymousCsrf(request: Request, submittedToken: unknown) {
  assertTrustedMutation(request);
  const submitted = assertCsrfToken(submittedToken, "csrf_token_missing");
  const cookieToken = assertCsrfToken(
    parseCookie(request.headers.get("cookie"), REQUEST_SECURITY_PROFILE.anonymousCsrfCookieName),
    "csrf_cookie_missing",
  );
  if (!constantTimeEqual(submitted, cookieToken)) {
    throw new RequestSecurityError("csrf_token_invalid");
  }
}

export function clientAddressKey(request: Request) {
  const value = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  if (value.length > 0 && value.length <= 64 && /^[0-9A-Fa-f:.]+$/u.test(value)) {
    return value.toLowerCase();
  }
  return "unknown-client";
}

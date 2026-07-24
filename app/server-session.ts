import { randomBase64Url, sha256Base64Url } from "./auth-compatibility.ts";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const SESSION_TOKEN_LENGTH = 43;

export const SERVER_SESSION_PROFILE = {
  id: "celestial-server-session-v1",
  cookieName: "__Host-celestial_session",
  cookieSameSite: "Lax",
  idleLifetimeSeconds: 24 * 60 * 60,
  absoluteLifetimeSeconds: 30 * 24 * 60 * 60,
  rotationIntervalSeconds: 15 * 60,
  activityRefreshSeconds: 5 * 60,
} as const;

export type SessionAuthMethod = "google" | "email_magic_link";
export type SessionAccountStatus = "active" | "deletion_pending" | "deleted";
export type SessionAccount = {
  id: string;
  email: string;
  displayName: string;
  status: SessionAccountStatus;
};
export type ServerSessionRecord = {
  id: string;
  accountId: string;
  identityId: string;
  tokenHash: string;
  authMethod: SessionAuthMethod;
  createdAt: string;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
  revokeReason: string;
  rotationCount: number;
};

export interface ServerSessionStore {
  createSession(session: ServerSessionRecord): Promise<void>;
  findSessionByTokenHash(tokenHash: string): Promise<ServerSessionRecord | null>;
  findAccountById(accountId: string): Promise<SessionAccount | null>;
  touchSession(sessionId: string, expectedTokenHash: string, lastSeenAt: string, expiresAt: string): Promise<boolean>;
  rotateSessionToken(
    sessionId: string,
    expectedTokenHash: string,
    nextTokenHash: string,
    issuedAt: string,
    lastSeenAt: string,
    expiresAt: string,
  ): Promise<boolean>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: string, reason: string): Promise<boolean>;
  appendAudit(accountId: string, eventType: string, occurredAt: string, metadataJson: string): Promise<void>;
}

export class ServerSessionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 401) {
    super(code);
    this.name = "ServerSessionError";
    this.code = code;
    this.status = status;
  }
}

function asDate(value: string, code: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ServerSessionError(code, 500);
  return date;
}
function minDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}
function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1000);
}
function assertToken(value: string) {
  if (value.length !== SESSION_TOKEN_LENGTH || !BASE64URL_PATTERN.test(value)) {
    throw new ServerSessionError("session_token_invalid");
  }
  return value;
}
function sessionMetadata(session: ServerSessionRecord, event: string) {
  return JSON.stringify({
    event,
    sessionId: session.id,
    authMethod: session.authMethod,
    rotationCount: session.rotationCount,
  });
}

export function parseServerSessionCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() !== SERVER_SESSION_PROFILE.cookieName) continue;
    const value = entry.slice(separator + 1).trim();
    return value.length === SESSION_TOKEN_LENGTH && BASE64URL_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function serializeServerSessionCookie(token: string, expiresAt: string, now = new Date()) {
  assertToken(token);
  const expires = asDate(expiresAt, "session_expiry_invalid");
  const maxAge = Math.max(0, Math.floor((expires.getTime() - now.getTime()) / 1000));
  return [
    `${SERVER_SESSION_PROFILE.cookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    `SameSite=${SERVER_SESSION_PROFILE.cookieSameSite}`,
    `Max-Age=${maxAge}`,
    `Expires=${expires.toUTCString()}`,
  ].join("; ");
}

export function clearServerSessionCookie() {
  return [
    `${SERVER_SESSION_PROFILE.cookieName}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    `SameSite=${SERVER_SESSION_PROFILE.cookieSameSite}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ].join("; ");
}

export async function createServerSession(
  store: ServerSessionStore,
  input: { accountId: string; identityId: string; authMethod: SessionAuthMethod },
  now = new Date(),
) {
  const account = await store.findAccountById(input.accountId);
  if (!account || account.status !== "active") {
    throw new ServerSessionError("session_account_inactive", 403);
  }

  const token = randomBase64Url(32);
  const tokenHash = await sha256Base64Url(token);
  const absoluteExpiresAt = addSeconds(now, SERVER_SESSION_PROFILE.absoluteLifetimeSeconds);
  const expiresAt = minDate(addSeconds(now, SERVER_SESSION_PROFILE.idleLifetimeSeconds), absoluteExpiresAt);
  const timestamp = now.toISOString();
  const session: ServerSessionRecord = {
    id: `ses_${randomBase64Url(18)}`,
    accountId: account.id,
    identityId: input.identityId,
    tokenHash,
    authMethod: input.authMethod,
    createdAt: timestamp,
    issuedAt: timestamp,
    lastSeenAt: timestamp,
    expiresAt: expiresAt.toISOString(),
    absoluteExpiresAt: absoluteExpiresAt.toISOString(),
    revokedAt: null,
    revokeReason: "",
    rotationCount: 0,
  };
  await store.createSession(session);
  await store.appendAudit(account.id, "account.session.created", timestamp, sessionMetadata(session, "created"));
  return {
    account,
    session,
    token,
    setCookie: serializeServerSessionCookie(token, session.expiresAt, now),
  };
}

export async function authenticateServerSession(
  store: ServerSessionStore,
  cookieHeader: string | null,
  now = new Date(),
) {
  const token = parseServerSessionCookie(cookieHeader);
  if (!token) throw new ServerSessionError("session_missing");
  const tokenHash = await sha256Base64Url(token);
  const session = await store.findSessionByTokenHash(tokenHash);
  if (!session) throw new ServerSessionError("session_invalid");
  if (session.revokedAt) throw new ServerSessionError("session_revoked");

  const account = await store.findAccountById(session.accountId);
  if (!account || account.status !== "active") {
    throw new ServerSessionError("session_account_inactive", 403);
  }

  const expiresAt = asDate(session.expiresAt, "session_expiry_invalid");
  const absoluteExpiresAt = asDate(session.absoluteExpiresAt, "session_absolute_expiry_invalid");
  if (expiresAt.getTime() <= now.getTime() || absoluteExpiresAt.getTime() <= now.getTime()) {
    await store.revokeSessionByTokenHash(tokenHash, now.toISOString(), "expired");
    throw new ServerSessionError("session_expired");
  }

  const issuedAt = asDate(session.issuedAt, "session_issued_at_invalid");
  const lastSeenAt = asDate(session.lastSeenAt, "session_last_seen_invalid");
  const nextExpiresAt = minDate(addSeconds(now, SERVER_SESSION_PROFILE.idleLifetimeSeconds), absoluteExpiresAt);
  const shouldRotate = now.getTime() - issuedAt.getTime() >= SERVER_SESSION_PROFILE.rotationIntervalSeconds * 1000;
  const shouldRefresh = now.getTime() - lastSeenAt.getTime() >= SERVER_SESSION_PROFILE.activityRefreshSeconds * 1000;

  if (shouldRotate) {
    const nextToken = randomBase64Url(32);
    const nextTokenHash = await sha256Base64Url(nextToken);
    const timestamp = now.toISOString();
    const rotated = await store.rotateSessionToken(
      session.id,
      tokenHash,
      nextTokenHash,
      timestamp,
      timestamp,
      nextExpiresAt.toISOString(),
    );
    if (!rotated) throw new ServerSessionError("session_rotation_conflict");
    const rotatedSession: ServerSessionRecord = {
      ...session,
      tokenHash: nextTokenHash,
      issuedAt: timestamp,
      lastSeenAt: timestamp,
      expiresAt: nextExpiresAt.toISOString(),
      rotationCount: session.rotationCount + 1,
    };
    await store.appendAudit(account.id, "account.session.rotated", timestamp, sessionMetadata(rotatedSession, "rotated"));
    return {
      account,
      session: rotatedSession,
      rotated: true,
      setCookie: serializeServerSessionCookie(nextToken, rotatedSession.expiresAt, now),
    };
  }

  if (shouldRefresh) {
    const timestamp = now.toISOString();
    const touched = await store.touchSession(session.id, tokenHash, timestamp, nextExpiresAt.toISOString());
    if (!touched) throw new ServerSessionError("session_refresh_conflict");
    return {
      account,
      session: { ...session, lastSeenAt: timestamp, expiresAt: nextExpiresAt.toISOString() },
      rotated: false,
      setCookie: serializeServerSessionCookie(token, nextExpiresAt.toISOString(), now),
    };
  }

  return { account, session, rotated: false, setCookie: null };
}

export async function revokeServerSession(
  store: ServerSessionStore,
  cookieHeader: string | null,
  reason = "logout",
  now = new Date(),
) {
  const token = parseServerSessionCookie(cookieHeader);
  if (!token) return false;
  const tokenHash = await sha256Base64Url(token);
  const existing = await store.findSessionByTokenHash(tokenHash);
  const revoked = await store.revokeSessionByTokenHash(tokenHash, now.toISOString(), reason.slice(0, 64));
  if (revoked && existing) {
    await store.appendAudit(
      existing.accountId,
      "account.session.revoked",
      now.toISOString(),
      sessionMetadata(existing, reason),
    );
  }
  return revoked;
}

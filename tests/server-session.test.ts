import assert from "node:assert/strict";
import test from "node:test";
import {
  SERVER_SESSION_PROFILE,
  ServerSessionError,
  authenticateServerSession,
  clearServerSessionCookie,
  createServerSession,
  parseServerSessionCookie,
  revokeServerSession,
  serializeServerSessionCookie,
  type ServerSessionRecord,
  type ServerSessionStore,
  type SessionAccount,
} from "../app/server-session.ts";

class MemorySessionStore implements ServerSessionStore {
  readonly accounts = new Map<string, SessionAccount>();
  readonly sessions = new Map<string, ServerSessionRecord>();
  readonly audits: Array<{ accountId: string; eventType: string; metadataJson: string }> = [];

  async createSession(session: ServerSessionRecord) {
    this.sessions.set(session.tokenHash, { ...session });
  }

  async findSessionByTokenHash(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    return session ? { ...session } : null;
  }

  async findAccountById(accountId: string) {
    const account = this.accounts.get(accountId);
    return account ? { ...account } : null;
  }

  async touchSession(
    sessionId: string,
    expectedTokenHash: string,
    lastSeenAt: string,
    expiresAt: string,
  ) {
    const session = this.sessions.get(expectedTokenHash);
    if (!session || session.id !== sessionId || session.revokedAt) return false;
    this.sessions.set(expectedTokenHash, { ...session, lastSeenAt, expiresAt });
    return true;
  }

  async rotateSessionToken(
    sessionId: string,
    expectedTokenHash: string,
    nextTokenHash: string,
    issuedAt: string,
    lastSeenAt: string,
    expiresAt: string,
  ) {
    const session = this.sessions.get(expectedTokenHash);
    if (!session || session.id !== sessionId || session.revokedAt) return false;
    this.sessions.delete(expectedTokenHash);
    this.sessions.set(nextTokenHash, {
      ...session,
      tokenHash: nextTokenHash,
      issuedAt,
      lastSeenAt,
      expiresAt,
      rotationCount: session.rotationCount + 1,
    });
    return true;
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: string, reason: string) {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revokedAt) return false;
    this.sessions.set(tokenHash, { ...session, revokedAt, revokeReason: reason });
    return true;
  }

  async appendAudit(
    accountId: string,
    eventType: string,
    _occurredAt: string,
    metadataJson: string,
  ) {
    this.audits.push({ accountId, eventType, metadataJson });
  }
}

function activeStore() {
  const store = new MemorySessionStore();
  store.accounts.set("acct_1", {
    id: "acct_1",
    email: "person@example.com",
    displayName: "Person",
    status: "active",
  });
  return store;
}

function cookieHeader(setCookie: string) {
  return setCookie.split(";", 1)[0];
}

test("server session cookie is bounded and hardened", () => {
  const token = "A".repeat(43);
  const expiresAt = new Date("2026-01-02T00:00:00.000Z").toISOString();
  const cookie = serializeServerSessionCookie(
    token,
    expiresAt,
    new Date("2026-01-01T00:00:00.000Z"),
  );
  assert.match(cookie, /^__Host-celestial_session=/u);
  assert.match(cookie, /Path=\//u);
  assert.match(cookie, /HttpOnly/u);
  assert.match(cookie, /Secure/u);
  assert.match(cookie, /SameSite=Lax/u);
  assert.equal(parseServerSessionCookie(cookieHeader(cookie)), token);
  assert.match(clearServerSessionCookie(), /Max-Age=0/u);
});

test("session creation stores only a SHA-256 token hash", async () => {
  const store = activeStore();
  const created = await createServerSession(
    store,
    { accountId: "acct_1", identityId: "idn_1", authMethod: "google" },
    new Date("2026-01-01T00:00:00.000Z"),
  );
  assert.equal(created.token.length, 43);
  assert.equal(created.session.tokenHash.length, 43);
  assert.notEqual(created.session.tokenHash, created.token);
  assert.equal(store.sessions.has(created.token), false);
  assert.equal(created.session.expiresAt, "2026-01-02T00:00:00.000Z");
  assert.equal(created.session.absoluteExpiresAt, "2026-01-31T00:00:00.000Z");
  assert.equal(store.audits[0]?.eventType, "account.session.created");
});

test("session token rotates after the bounded rotation interval", async () => {
  const store = activeStore();
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const created = await createServerSession(
    store,
    { accountId: "acct_1", identityId: "idn_1", authMethod: "google" },
    createdAt,
  );
  const originalCookie = cookieHeader(created.setCookie);
  const authenticated = await authenticateServerSession(
    store,
    originalCookie,
    new Date(createdAt.getTime() + (SERVER_SESSION_PROFILE.rotationIntervalSeconds + 1) * 1000),
  );
  assert.equal(authenticated.rotated, true);
  assert.equal(authenticated.session.rotationCount, 1);
  assert.ok(authenticated.setCookie);
  await assert.rejects(
    () => authenticateServerSession(store, originalCookie, new Date("2026-01-01T00:16:02.000Z")),
    (error: unknown) => error instanceof ServerSessionError && error.code === "session_invalid",
  );
});

test("active sessions refresh idle expiry without unnecessary rotation", async () => {
  const store = activeStore();
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const created = await createServerSession(
    store,
    { accountId: "acct_1", identityId: "idn_1", authMethod: "email_magic_link" },
    createdAt,
  );
  const authenticated = await authenticateServerSession(
    store,
    cookieHeader(created.setCookie),
    new Date(createdAt.getTime() + (SERVER_SESSION_PROFILE.activityRefreshSeconds + 1) * 1000),
  );
  assert.equal(authenticated.rotated, false);
  assert.ok(authenticated.setCookie);
  assert.equal(authenticated.session.rotationCount, 0);
  assert.equal(authenticated.session.expiresAt, "2026-01-02T00:05:01.000Z");
});

test("expired and revoked sessions fail closed", async () => {
  const store = activeStore();
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const created = await createServerSession(
    store,
    { accountId: "acct_1", identityId: "idn_1", authMethod: "google" },
    createdAt,
  );
  const header = cookieHeader(created.setCookie);
  await assert.rejects(
    () => authenticateServerSession(store, header, new Date("2026-01-02T00:00:01.000Z")),
    (error: unknown) => error instanceof ServerSessionError && error.code === "session_expired",
  );

  const second = await createServerSession(
    store,
    { accountId: "acct_1", identityId: "idn_1", authMethod: "google" },
    createdAt,
  );
  assert.equal(await revokeServerSession(store, cookieHeader(second.setCookie)), true);
  await assert.rejects(
    () => authenticateServerSession(store, cookieHeader(second.setCookie), createdAt),
    (error: unknown) => error instanceof ServerSessionError && error.code === "session_revoked",
  );
  assert.equal(store.audits.at(-1)?.eventType, "account.session.revoked");
});

test("inactive accounts cannot create or use sessions", async () => {
  const store = activeStore();
  store.accounts.set("acct_1", {
    ...store.accounts.get("acct_1")!,
    status: "deletion_pending",
  });
  await assert.rejects(
    () =>
      createServerSession(store, {
        accountId: "acct_1",
        identityId: "idn_1",
        authMethod: "google",
      }),
    (error: unknown) =>
      error instanceof ServerSessionError && error.code === "session_account_inactive",
  );
});

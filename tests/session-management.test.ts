import assert from "node:assert/strict";
import test from "node:test";
import {
  SessionManagementError,
  type SessionManagementStore,
  listManagedSessions,
  revokeManagedSession,
  revokeOtherManagedSessions,
} from "../app/session-management.ts";
import type {
  ServerSessionRecord,
  SessionAccount,
} from "../app/server-session.ts";

const CURRENT_ID = "ses_AAAAAAAAAAAAAAAAAAAAAAAA";
const OTHER_ID = "ses_BBBBBBBBBBBBBBBBBBBBBBBB";
const THIRD_ID = "ses_CCCCCCCCCCCCCCCCCCCCCCCC";
const NOW = new Date("2026-07-24T15:00:00.000Z");

function session(id: string, lastSeenAt = "2026-07-24T14:55:00.000Z"): ServerSessionRecord {
  return {
    id,
    accountId: "acct_example",
    identityId: "idn_example",
    tokenHash: "hash-not-exposed",
    authMethod: id === OTHER_ID ? "email_magic_link" : "google",
    createdAt: "2026-07-24T12:00:00.000Z",
    issuedAt: "2026-07-24T14:45:00.000Z",
    lastSeenAt,
    expiresAt: "2026-07-25T14:55:00.000Z",
    absoluteExpiresAt: "2026-08-23T12:00:00.000Z",
    revokedAt: null,
    revokeReason: "",
    rotationCount: 2,
  };
}

class MemoryManagementStore implements SessionManagementStore {
  sessions: ServerSessionRecord[];
  audits: Array<{ accountId: string; eventType: string; metadataJson: string }> = [];
  revokeOneCalls: string[] = [];
  revokeOtherCalls = 0;

  constructor(sessions: ServerSessionRecord[]) {
    this.sessions = sessions;
  }

  async createSession() {}

  async findSessionByTokenHash(tokenHash: string) {
    return this.sessions.find((item) => item.tokenHash === tokenHash) ?? null;
  }

  async findAccountById(): Promise<SessionAccount> {
    return {
      id: "acct_example",
      email: "person@example.com",
      displayName: "Person",
      status: "active",
    };
  }

  async touchSession() {
    return true;
  }

  async rotateSessionToken() {
    return true;
  }

  async revokeSessionByTokenHash() {
    return true;
  }

  async listAccountSessions(accountId: string, activeAt: string, limit: number) {
    assert.equal(accountId, "acct_example");
    assert.equal(activeAt, NOW.toISOString());
    assert.equal(limit, 25);
    return this.sessions.slice(0, limit);
  }

  async revokeSessionById(
    accountId: string,
    sessionId: string,
    _revokedAt: string,
    reason: string,
  ) {
    assert.equal(accountId, "acct_example");
    assert.equal(reason, "user_revoked");
    this.revokeOneCalls.push(sessionId);
    const before = this.sessions.length;
    this.sessions = this.sessions.filter((item) => item.id !== sessionId);
    return this.sessions.length !== before;
  }

  async revokeOtherSessions(
    accountId: string,
    currentSessionId: string,
    _revokedAt: string,
    reason: string,
  ) {
    assert.equal(accountId, "acct_example");
    assert.equal(currentSessionId, CURRENT_ID);
    assert.equal(reason, "user_revoked_others");
    this.revokeOtherCalls += 1;
    const before = this.sessions.length;
    this.sessions = this.sessions.filter((item) => item.id === currentSessionId);
    return before - this.sessions.length;
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

test("session listing marks only the authenticated browser as current", async () => {
  const store = new MemoryManagementStore([
    session(OTHER_ID, "2026-07-24T14:50:00.000Z"),
    session(CURRENT_ID),
  ]);
  const sessions = await listManagedSessions(
    store,
    "acct_example",
    CURRENT_ID,
    NOW,
  );

  assert.equal(sessions.length, 2);
  assert.equal(sessions.filter((item) => item.current).length, 1);
  assert.equal(sessions.find((item) => item.id === CURRENT_ID)?.current, true);
  assert.equal(sessions.find((item) => item.id === OTHER_ID)?.authMethod, "email_magic_link");
  assert.equal(Object.hasOwn(sessions[0], "tokenHash"), false);
});

test("session listing rejects a result that omits the authenticated session", async () => {
  const store = new MemoryManagementStore([session(OTHER_ID)]);
  await assert.rejects(
    () => listManagedSessions(store, "acct_example", CURRENT_ID, NOW),
    (error: unknown) =>
      error instanceof SessionManagementError &&
      error.code === "current_session_not_listed" &&
      error.status === 409,
  );
});

test("one other session can be revoked only through account-scoped storage", async () => {
  const store = new MemoryManagementStore([
    session(CURRENT_ID),
    session(OTHER_ID),
  ]);
  const result = await revokeManagedSession(
    store,
    {
      accountId: "acct_example",
      currentSessionId: CURRENT_ID,
      targetSessionId: OTHER_ID,
    },
    NOW,
  );

  assert.deepEqual(result, { revoked: true, sessionId: OTHER_ID });
  assert.deepEqual(store.revokeOneCalls, [OTHER_ID]);
  assert.equal(store.sessions.length, 1);
  assert.equal(store.sessions[0].id, CURRENT_ID);
  assert.equal(store.audits[0].eventType, "account.session.revoked_by_user");
  assert.match(store.audits[0].metadataJson, /revoke-one/);
});

test("the management endpoint cannot revoke its own current session", async () => {
  const store = new MemoryManagementStore([session(CURRENT_ID)]);
  await assert.rejects(
    () =>
      revokeManagedSession(
        store,
        {
          accountId: "acct_example",
          currentSessionId: CURRENT_ID,
          targetSessionId: CURRENT_ID,
        },
        NOW,
      ),
    (error: unknown) =>
      error instanceof SessionManagementError &&
      error.code === "current_session_requires_logout" &&
      error.status === 409,
  );
  assert.deepEqual(store.revokeOneCalls, []);
});

test("all other sessions are revoked while the current browser remains active", async () => {
  const store = new MemoryManagementStore([
    session(CURRENT_ID),
    session(OTHER_ID),
    session(THIRD_ID),
  ]);
  const result = await revokeOtherManagedSessions(
    store,
    { accountId: "acct_example", currentSessionId: CURRENT_ID },
    NOW,
  );

  assert.deepEqual(result, { revoked: true, count: 2 });
  assert.equal(store.revokeOtherCalls, 1);
  assert.deepEqual(store.sessions.map((item) => item.id), [CURRENT_ID]);
  assert.equal(store.audits[0].eventType, "account.session.others_revoked");
  assert.match(store.audits[0].metadataJson, /"count":2/);
});

test("malformed session identifiers are rejected before storage access", async () => {
  const store = new MemoryManagementStore([session(CURRENT_ID)]);
  await assert.rejects(
    () =>
      revokeManagedSession(
        store,
        {
          accountId: "acct_example",
          currentSessionId: CURRENT_ID,
          targetSessionId: "../../other-account",
        },
        NOW,
      ),
    (error: unknown) =>
      error instanceof SessionManagementError && error.code === "session_id_invalid",
  );
  assert.deepEqual(store.revokeOneCalls, []);
});

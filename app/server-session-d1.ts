import { auditEventId } from "./account-identity-persistence.ts";
import type {
  ServerSessionRecord,
  ServerSessionStore,
  SessionAccount,
  SessionAuthMethod,
} from "./server-session.ts";

type SessionRow = {
  id: string;
  account_id: string;
  identity_id: string;
  token_hash: string;
  auth_method: SessionAuthMethod;
  created_at: string;
  issued_at: string;
  last_seen_at: string;
  expires_at: string;
  absolute_expires_at: string;
  revoked_at: string | null;
  revoke_reason: string;
  rotation_count: number;
};

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  status: SessionAccount["status"];
};

function changes(result: { meta?: { changes?: number } }) {
  return Number(result.meta?.changes ?? 0);
}

function mapSession(row: SessionRow): ServerSessionRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    identityId: row.identity_id,
    tokenHash: row.token_hash,
    authMethod: row.auth_method,
    createdAt: row.created_at,
    issuedAt: row.issued_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    absoluteExpiresAt: row.absolute_expires_at,
    revokedAt: row.revoked_at,
    revokeReason: row.revoke_reason,
    rotationCount: Number(row.rotation_count),
  };
}

function mapAccount(row: AccountRow): SessionAccount {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
  };
}

export class D1ServerSessionStore implements ServerSessionStore {
  constructor(private readonly db: D1Database) {}

  async createSession(session: ServerSessionRecord) {
    await this.db
      .prepare(
        "INSERT INTO auth_sessions (id, account_id, identity_id, token_hash, auth_method, created_at, issued_at, last_seen_at, expires_at, absolute_expires_at, revoked_at, revoke_reason, rotation_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '', 0)",
      )
      .bind(
        session.id,
        session.accountId,
        session.identityId,
        session.tokenHash,
        session.authMethod,
        session.createdAt,
        session.issuedAt,
        session.lastSeenAt,
        session.expiresAt,
        session.absoluteExpiresAt,
      )
      .run();
  }

  async findSessionByTokenHash(tokenHash: string) {
    const row = await this.db
      .prepare(
        "SELECT id, account_id, identity_id, token_hash, auth_method, created_at, issued_at, last_seen_at, expires_at, absolute_expires_at, revoked_at, revoke_reason, rotation_count FROM auth_sessions WHERE token_hash = ? LIMIT 1",
      )
      .bind(tokenHash)
      .first<SessionRow>();
    return row ? mapSession(row) : null;
  }

  async findAccountById(accountId: string) {
    const row = await this.db
      .prepare(
        "SELECT id, email, display_name, status FROM accounts WHERE id = ? LIMIT 1",
      )
      .bind(accountId)
      .first<AccountRow>();
    return row ? mapAccount(row) : null;
  }

  async touchSession(
    sessionId: string,
    expectedTokenHash: string,
    lastSeenAt: string,
    expiresAt: string,
  ) {
    const result = await this.db
      .prepare(
        "UPDATE auth_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at >= ? AND absolute_expires_at >= ?",
      )
      .bind(
        lastSeenAt,
        expiresAt,
        sessionId,
        expectedTokenHash,
        lastSeenAt,
        lastSeenAt,
      )
      .run();
    return changes(result) === 1;
  }

  async rotateSessionToken(
    sessionId: string,
    expectedTokenHash: string,
    nextTokenHash: string,
    issuedAt: string,
    lastSeenAt: string,
    expiresAt: string,
  ) {
    const result = await this.db
      .prepare(
        "UPDATE auth_sessions SET token_hash = ?, issued_at = ?, last_seen_at = ?, expires_at = ?, rotation_count = rotation_count + 1 WHERE id = ? AND token_hash = ? AND revoked_at IS NULL AND expires_at >= ? AND absolute_expires_at >= ?",
      )
      .bind(
        nextTokenHash,
        issuedAt,
        lastSeenAt,
        expiresAt,
        sessionId,
        expectedTokenHash,
        issuedAt,
        issuedAt,
      )
      .run();
    return changes(result) === 1;
  }

  async revokeSessionByTokenHash(
    tokenHash: string,
    revokedAt: string,
    reason: string,
  ) {
    const result = await this.db
      .prepare(
        "UPDATE auth_sessions SET revoked_at = ?, revoke_reason = ? WHERE token_hash = ? AND revoked_at IS NULL",
      )
      .bind(revokedAt, reason, tokenHash)
      .run();
    return changes(result) === 1;
  }

  async appendAudit(
    accountId: string,
    eventType: string,
    occurredAt: string,
    metadataJson: string,
  ) {
    await this.db
      .prepare(
        "INSERT INTO account_audit_events (id, account_id, event_type, occurred_at, metadata_json) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(auditEventId(), accountId, eventType, occurredAt, metadataJson)
      .run();
  }
}

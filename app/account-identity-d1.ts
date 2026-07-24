import { env } from "cloudflare:workers";
import {
  AccountPersistenceError,
  auditEventId,
  type AccountIdentityStore,
  type AccountRecord,
  type IdentityProvider,
  type IdentityRecord,
  type MagicLinkRecord,
  type MagicLinkRegistration,
} from "./account-identity-persistence.ts";

type AccountRow = {
  id: string;
  email: string;
  display_name: string;
  status: AccountRecord["status"];
  created_at: string;
  updated_at: string;
};

type IdentityRow = {
  id: string;
  account_id: string;
  provider: IdentityProvider;
  provider_subject: string;
  email: string;
  display_name: string;
  picture_url: string | null;
  email_verified_at: string;
  last_verified_at: string;
  created_at: string;
  updated_at: string;
};

type MagicLinkRow = {
  fingerprint: string;
  email: string;
  return_to: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

function mapAccount(row: AccountRow): AccountRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIdentity(row: IdentityRow): IdentityRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    provider: row.provider,
    providerSubject: row.provider_subject,
    email: row.email,
    displayName: row.display_name,
    pictureUrl: row.picture_url,
    emailVerifiedAt: row.email_verified_at,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMagicLink(row: MagicLinkRow): MagicLinkRecord {
  return {
    fingerprint: row.fingerprint,
    email: row.email,
    returnTo: row.return_to,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    createdAt: row.created_at,
  };
}

function changes(result: { meta?: { changes?: number } }) {
  return Number(result.meta?.changes ?? 0);
}

export class D1AccountIdentityStore implements AccountIdentityStore {
  constructor(private readonly db: D1Database) {}

  async findAccountByEmail(email: string) {
    const row = await this.db
      .prepare(
        "SELECT id, email, display_name, status, created_at, updated_at FROM accounts WHERE email = ? LIMIT 1",
      )
      .bind(email)
      .first<AccountRow>();
    return row ? mapAccount(row) : null;
  }

  async findAccountById(accountId: string) {
    const row = await this.db
      .prepare(
        "SELECT id, email, display_name, status, created_at, updated_at FROM accounts WHERE id = ? LIMIT 1",
      )
      .bind(accountId)
      .first<AccountRow>();
    return row ? mapAccount(row) : null;
  }

  async findIdentity(provider: IdentityProvider, providerSubject: string) {
    const row = await this.db
      .prepare(
        "SELECT id, account_id, provider, provider_subject, email, display_name, picture_url, email_verified_at, last_verified_at, created_at, updated_at FROM account_identities WHERE provider = ? AND provider_subject = ? LIMIT 1",
      )
      .bind(provider, providerSubject)
      .first<IdentityRow>();
    return row ? mapIdentity(row) : null;
  }

  async findAccountProviderIdentity(accountId: string, provider: IdentityProvider) {
    const row = await this.db
      .prepare(
        "SELECT id, account_id, provider, provider_subject, email, display_name, picture_url, email_verified_at, last_verified_at, created_at, updated_at FROM account_identities WHERE account_id = ? AND provider = ? LIMIT 1",
      )
      .bind(accountId, provider)
      .first<IdentityRow>();
    return row ? mapIdentity(row) : null;
  }

  async countAccountIdentities(accountId: string) {
    const row = await this.db
      .prepare("SELECT COUNT(*) AS count FROM account_identities WHERE account_id = ?")
      .bind(accountId)
      .first<{ count: number }>();
    return Number(row?.count ?? 0);
  }

  async createAccount(account: AccountRecord) {
    const result = await this.db
      .prepare(
        "INSERT OR IGNORE INTO accounts (id, email, display_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        account.id,
        account.email,
        account.displayName,
        account.status,
        account.createdAt,
        account.updatedAt,
      )
      .run();
    const stored = await this.findAccountByEmail(account.email);
    if (!stored) throw new AccountPersistenceError("account_persistence_unavailable", 503);
    return { account: stored, created: changes(result) === 1 };
  }

  async createIdentity(identity: IdentityRecord) {
    const result = await this.db
      .prepare(
        "INSERT OR IGNORE INTO account_identities (id, account_id, provider, provider_subject, email, display_name, picture_url, email_verified_at, last_verified_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        identity.id,
        identity.accountId,
        identity.provider,
        identity.providerSubject,
        identity.email,
        identity.displayName,
        identity.pictureUrl,
        identity.emailVerifiedAt,
        identity.lastVerifiedAt,
        identity.createdAt,
        identity.updatedAt,
      )
      .run();
    const stored = await this.findIdentity(identity.provider, identity.providerSubject);
    if (!stored) throw new AccountPersistenceError("account_persistence_unavailable", 503);
    return { identity: stored, created: changes(result) === 1 };
  }

  async updateAccountDisplayName(accountId: string, displayName: string, updatedAt: string) {
    await this.db
      .prepare(
        "UPDATE accounts SET display_name = CASE WHEN display_name = '' THEN ? ELSE display_name END, updated_at = ? WHERE id = ?",
      )
      .bind(displayName, updatedAt, accountId)
      .run();
  }

  async touchIdentity(
    identityId: string,
    email: string,
    displayName: string,
    pictureUrl: string | null,
    verifiedAt: string,
  ) {
    await this.db
      .prepare(
        "UPDATE account_identities SET email = ?, display_name = CASE WHEN ? <> '' THEN ? ELSE display_name END, picture_url = COALESCE(?, picture_url), last_verified_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(email, displayName, displayName, pictureUrl, verifiedAt, verifiedAt, identityId)
      .run();
  }

  async appendAudit(accountId: string, eventType: string, occurredAt: string, metadataJson: string) {
    await this.db
      .prepare(
        "INSERT INTO account_audit_events (id, account_id, event_type, occurred_at, metadata_json) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(auditEventId(), accountId, eventType, occurredAt, metadataJson)
      .run();
  }

  async registerMagicLink(registration: MagicLinkRegistration) {
    await this.db
      .prepare(
        "INSERT INTO email_magic_link_tokens (fingerprint, email, return_to, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)",
      )
      .bind(
        registration.fingerprint,
        registration.email,
        registration.returnTo,
        registration.expiresAt,
        registration.createdAt,
      )
      .run();
  }

  async findMagicLink(fingerprint: string) {
    const row = await this.db
      .prepare(
        "SELECT fingerprint, email, return_to, expires_at, consumed_at, created_at FROM email_magic_link_tokens WHERE fingerprint = ? LIMIT 1",
      )
      .bind(fingerprint)
      .first<MagicLinkRow>();
    return row ? mapMagicLink(row) : null;
  }

  async consumeMagicLink(fingerprint: string, consumedAt: string) {
    const result = await this.db
      .prepare(
        "UPDATE email_magic_link_tokens SET consumed_at = ? WHERE fingerprint = ? AND consumed_at IS NULL AND expires_at >= ?",
      )
      .bind(consumedAt, fingerprint, consumedAt)
      .run();
    return changes(result) === 1;
  }

  async revokeMagicLink(fingerprint: string) {
    await this.db
      .prepare("DELETE FROM email_magic_link_tokens WHERE fingerprint = ? AND consumed_at IS NULL")
      .bind(fingerprint)
      .run();
  }
}

import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    status: text("status", { enum: ["active", "deletion_pending", "deleted"] }).notNull().default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletionRequestedAt: text("deletion_requested_at"),
    deletedAt: text("deleted_at"),
  },
  (table) => [uniqueIndex("accounts_email_unique").on(table.email)],
);

export const accountIdentities = sqliteTable(
  "account_identities",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["google", "email_magic_link"] }).notNull(),
    providerSubject: text("provider_subject").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull().default(""),
    pictureUrl: text("picture_url"),
    emailVerifiedAt: text("email_verified_at").notNull(),
    lastVerifiedAt: text("last_verified_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("account_identities_provider_subject_unique").on(table.provider, table.providerSubject),
    uniqueIndex("account_identities_account_provider_unique").on(table.accountId, table.provider),
    index("account_identities_account_idx").on(table.accountId),
    index("account_identities_email_idx").on(table.email),
  ],
);

export const emailMagicLinkTokens = sqliteTable(
  "email_magic_link_tokens",
  {
    fingerprint: text("fingerprint").primaryKey(),
    email: text("email").notNull(),
    returnTo: text("return_to").notNull().default("/"),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("email_magic_link_tokens_expiry_idx").on(table.expiresAt),
    index("email_magic_link_tokens_email_idx").on(table.email),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    identityId: text("identity_id")
      .notNull()
      .references(() => accountIdentities.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    authMethod: text("auth_method", { enum: ["google", "email_magic_link"] }).notNull(),
    createdAt: text("created_at").notNull(),
    issuedAt: text("issued_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    absoluteExpiresAt: text("absolute_expires_at").notNull(),
    revokedAt: text("revoked_at"),
    revokeReason: text("revoke_reason").notNull().default(""),
    rotationCount: integer("rotation_count").notNull().default(0),
    csrfTokenHash: text("csrf_token_hash").notNull().default(""),
    csrfIssuedAt: text("csrf_issued_at").notNull().default(""),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    index("auth_sessions_account_idx").on(table.accountId),
    index("auth_sessions_account_active_idx").on(table.accountId, table.revokedAt),
    index("auth_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const authRateLimits = sqliteTable(
  "auth_rate_limits",
  {
    bucketHash: text("bucket_hash").primaryKey(),
    scope: text("scope").notNull(),
    windowStartedAt: integer("window_started_at").notNull(),
    windowExpiresAt: integer("window_expires_at").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("auth_rate_limits_scope_idx").on(table.scope),
    index("auth_rate_limits_expiry_idx").on(table.windowExpiresAt),
  ],
);

export const familyProfiles = sqliteTable(
  "family_profiles",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    relationship: text("relationship").notNull(),
    birthDate: text("birth_date").notNull(),
    birthTime: text("birth_time").notNull().default(""),
    timeConfidence: text("time_confidence").notNull(),
    uncertaintyMinutes: integer("uncertainty_minutes").notNull().default(0),
    location: text("location").notNull(),
    timezoneId: text("timezone_id").notNull(),
    latitudeE6: integer("latitude_e6").notNull(),
    longitudeE6: integer("longitude_e6").notNull(),
    placeProvider: text("place_provider").notNull(),
    consentConfirmedAt: text("consent_confirmed_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("family_profiles_account_idx").on(table.accountId)],
);

export const accountAuditEvents = sqliteTable(
  "account_audit_events",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    eventType: text("event_type").notNull(),
    occurredAt: text("occurred_at").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
  },
  (table) => [index("account_audit_account_idx").on(table.accountId)],
);

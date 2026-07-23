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

PRAGMA foreign_keys=ON;

CREATE TABLE `auth_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `identity_id` text NOT NULL,
  `token_hash` text NOT NULL,
  `auth_method` text NOT NULL,
  `created_at` text NOT NULL,
  `issued_at` text NOT NULL,
  `last_seen_at` text NOT NULL,
  `expires_at` text NOT NULL,
  `absolute_expires_at` text NOT NULL,
  `revoked_at` text,
  `revoke_reason` text DEFAULT '' NOT NULL,
  `rotation_count` integer DEFAULT 0 NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`identity_id`) REFERENCES `account_identities`(`id`) ON UPDATE no action ON DELETE cascade,
  CHECK (`auth_method` IN ('google', 'email_magic_link')),
  CHECK (`rotation_count` >= 0)
);
CREATE UNIQUE INDEX `auth_sessions_token_hash_unique` ON `auth_sessions` (`token_hash`);
CREATE INDEX `auth_sessions_account_idx` ON `auth_sessions` (`account_id`);
CREATE INDEX `auth_sessions_account_active_idx` ON `auth_sessions` (`account_id`, `revoked_at`);
CREATE INDEX `auth_sessions_expiry_idx` ON `auth_sessions` (`expires_at`);

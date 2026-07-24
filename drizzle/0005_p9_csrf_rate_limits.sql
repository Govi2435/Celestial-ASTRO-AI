PRAGMA foreign_keys=ON;

ALTER TABLE `auth_sessions` ADD COLUMN `csrf_token_hash` text DEFAULT '' NOT NULL;
ALTER TABLE `auth_sessions` ADD COLUMN `csrf_issued_at` text DEFAULT '' NOT NULL;

CREATE TABLE `auth_rate_limits` (
  `bucket_hash` text PRIMARY KEY NOT NULL,
  `scope` text NOT NULL,
  `window_started_at` integer NOT NULL,
  `window_expires_at` integer NOT NULL,
  `request_count` integer DEFAULT 0 NOT NULL,
  `updated_at` text NOT NULL,
  CHECK (`request_count` >= 0),
  CHECK (`window_expires_at` >= `window_started_at`)
);
CREATE INDEX `auth_rate_limits_scope_idx` ON `auth_rate_limits` (`scope`);
CREATE INDEX `auth_rate_limits_expiry_idx` ON `auth_rate_limits` (`window_expires_at`);

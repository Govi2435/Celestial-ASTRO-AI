PRAGMA foreign_keys=ON;

CREATE TABLE `accounts` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `display_name` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `deletion_requested_at` text,
  `deleted_at` text
);
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);

CREATE TABLE `family_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `display_name` text NOT NULL,
  `relationship` text NOT NULL,
  `birth_date` text NOT NULL,
  `birth_time` text DEFAULT '' NOT NULL,
  `time_confidence` text NOT NULL,
  `uncertainty_minutes` integer DEFAULT 0 NOT NULL,
  `location` text NOT NULL,
  `timezone_id` text NOT NULL,
  `latitude_e6` integer NOT NULL,
  `longitude_e6` integer NOT NULL,
  `place_provider` text NOT NULL,
  `consent_confirmed_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `family_profiles_account_idx` ON `family_profiles` (`account_id`);

CREATE TABLE `account_audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `event_type` text NOT NULL,
  `occurred_at` text NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL
);
CREATE INDEX `account_audit_account_idx` ON `account_audit_events` (`account_id`);

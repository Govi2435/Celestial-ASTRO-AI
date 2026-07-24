PRAGMA foreign_keys=ON;

CREATE TABLE `account_identities` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_subject` text NOT NULL,
  `email` text NOT NULL,
  `display_name` text DEFAULT '' NOT NULL,
  `picture_url` text,
  `email_verified_at` text NOT NULL,
  `last_verified_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
  CHECK (`provider` IN ('google', 'email_magic_link'))
);
CREATE UNIQUE INDEX `account_identities_provider_subject_unique` ON `account_identities` (`provider`, `provider_subject`);
CREATE UNIQUE INDEX `account_identities_account_provider_unique` ON `account_identities` (`account_id`, `provider`);
CREATE INDEX `account_identities_account_idx` ON `account_identities` (`account_id`);
CREATE INDEX `account_identities_email_idx` ON `account_identities` (`email`);

CREATE TABLE `email_magic_link_tokens` (
  `fingerprint` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `return_to` text DEFAULT '/' NOT NULL,
  `expires_at` text NOT NULL,
  `consumed_at` text,
  `created_at` text NOT NULL
);
CREATE INDEX `email_magic_link_tokens_expiry_idx` ON `email_magic_link_tokens` (`expires_at`);
CREATE INDEX `email_magic_link_tokens_email_idx` ON `email_magic_link_tokens` (`email`);

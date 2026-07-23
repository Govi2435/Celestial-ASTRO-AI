CREATE TABLE `professional_workspaces` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `owner_account_id` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`owner_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `professional_members` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `account_id` text NOT NULL,
  `role` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `professional_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `professional_members_workspace_account_unique` ON `professional_members` (`workspace_id`, `account_id`);

CREATE TABLE `professional_cases` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `client_account_id` text,
  `assigned_professional_id` text NOT NULL,
  `family_profile_id` text,
  `chart_id` text,
  `status` text NOT NULL,
  `consent_granted_at` text,
  `consent_revoked_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `professional_workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`client_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`family_profile_id`) REFERENCES `family_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `professional_cases_workspace_idx` ON `professional_cases` (`workspace_id`);
CREATE INDEX `professional_cases_assignee_idx` ON `professional_cases` (`assigned_professional_id`);

CREATE TABLE `professional_notes` (
  `id` text PRIMARY KEY NOT NULL,
  `case_id` text NOT NULL,
  `author_account_id` text NOT NULL,
  `body` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`case_id`) REFERENCES `professional_cases`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`author_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `professional_notes_case_idx` ON `professional_notes` (`case_id`);

CREATE TABLE `professional_appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `case_id` text NOT NULL,
  `status` text NOT NULL,
  `starts_at` text NOT NULL,
  `ends_at` text NOT NULL,
  `timezone_id` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`case_id`) REFERENCES `professional_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `professional_appointments_case_idx` ON `professional_appointments` (`case_id`);

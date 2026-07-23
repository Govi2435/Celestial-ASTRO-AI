CREATE TABLE `subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_customer_id` text,
  `provider_subscription_id` text,
  `plan_id` text NOT NULL,
  `status` text NOT NULL,
  `current_period_end` text,
  `cancel_at_period_end` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX `subscriptions_account_unique` ON `subscriptions` (`account_id`);
CREATE UNIQUE INDEX `subscriptions_provider_subscription_unique` ON `subscriptions` (`provider_subscription_id`);

CREATE TABLE `billing_events` (
  `id` text PRIMARY KEY NOT NULL,
  `provider` text NOT NULL,
  `provider_event_id` text NOT NULL,
  `account_id` text,
  `event_type` text NOT NULL,
  `received_at` text NOT NULL,
  `processed_at` text,
  `payload_sha256` text NOT NULL,
  `processing_error` text
);
CREATE UNIQUE INDEX `billing_events_provider_event_unique` ON `billing_events` (`provider`, `provider_event_id`);
CREATE INDEX `billing_events_account_idx` ON `billing_events` (`account_id`);

CREATE TABLE `premium_report_grants` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `chart_id` text NOT NULL,
  `subscription_id` text,
  `granted_at` text NOT NULL,
  `expires_at` text,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE set null
);
CREATE INDEX `premium_report_grants_account_idx` ON `premium_report_grants` (`account_id`);

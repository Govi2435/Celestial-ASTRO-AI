# ADR-0018: D1-backed account and identity persistence

- Status: Accepted for ASTRO-124
- Date: 2026-07-24
- Jira: `KAN-18 / ASTRO-124`

## Context

Google OAuth and email magic-link provider verification were already proven on Cloudflare staging, but neither flow created a durable Celestial account or provider identity. Email links were browser-bound and could not be consumed safely across devices. The repository already contained a P6 `accounts` table foundation but had no identity or durable verification-token tables and no active D1 binding.

## Decision

Use an isolated Cloudflare D1 database bound as `DB` for account and identity persistence.

Add:

- `account_identities` with provider-subject and account-provider uniqueness;
- `email_magic_link_tokens` containing token fingerprints, expiry, and consumption state;
- a provider-neutral persistence service with explicit safe-linking rules;
- a raw D1 adapter using prepared statements and bound parameters;
- audit events for account creation, identity linking, and identity verification;
- deployment-time migration application before the Worker is deployed.

Continue to keep authenticated session issuance separate in ASTRO-125.

## Consequences

### Positive

- Verified identities survive deployments and browser restarts.
- Email links can be consumed once from another browser or device.
- Provider conflicts fail closed rather than silently merging accounts.
- No OAuth access or refresh tokens are persisted.
- Staging remains isolated from production resources.

### Trade-offs

- Staging activation requires a D1 database and a GitHub environment secret containing its database ID.
- The first D1-enabled deployment changes staging from identity-verification-only to durable account creation.
- Account existence becomes durable before authenticated sessions exist; product authorization remains disabled until ASTRO-125.

## Rejected alternatives

- Browser cookies as the only persistence mechanism: not durable and prevents cross-device verification.
- Provider-specific account tables: duplicates linking and conflict rules.
- Automatic linking solely by matching Google email: unsafe without prior ownership proof for an existing account.
- Persisting raw magic-link tokens: increases impact of database disclosure.
- Creating sessions in the same change: combines identity persistence with a separate high-risk session boundary.

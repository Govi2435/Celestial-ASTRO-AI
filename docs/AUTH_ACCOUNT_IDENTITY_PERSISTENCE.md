# Account and Identity Persistence

- Status: ASTRO-124 implementation and staging activation guide
- Jira: `KAN-18 / ASTRO-124`
- Runtime: Vinext on Cloudflare Workers
- Persistence: isolated Cloudflare D1 database bound as `DB`

## Scope

ASTRO-124 persists verified Google and email-magic-link identities into durable account records. It does not create an authenticated browser session. Secure server sessions remain ASTRO-125.

## Tables

### `accounts`

One durable Celestial account per normalized verified email address.

### `account_identities`

Stores provider identities linked to an account.

- Providers: `google`, `email_magic_link`
- Provider subject is unique per provider.
- One identity per provider is allowed for each account.
- Verified email and provider metadata are stored; OAuth access and refresh tokens are not stored.

### `email_magic_link_tokens`

Stores the SHA-256 fingerprint of each issued magic-link token, its normalized email, safe return target, expiry, and single-use consumption timestamp. The clear token is never stored.

### `account_audit_events`

Records bounded account and identity lifecycle events without storing secrets, tokens, provider payloads, or IP addresses.

## Safe account-linking policy

1. A verified email magic link can create an account or verify its email identity.
2. A Google identity can create a new account when no account exists for the verified email.
3. Google can link to an existing account only when email ownership was already proven through an email-magic-link identity, or when upgrading a legacy account that has no identities.
4. A different Google subject cannot replace an existing Google identity on the account.
5. Deleted or deletion-pending accounts are not silently reactivated.
6. Conflicts fail closed with bounded diagnostics; they do not merge accounts automatically.

## Durable magic-link consumption

Email verification is no longer restricted to the browser that requested the link after D1 is activated.

1. The request route creates an encrypted ten-minute link.
2. Its SHA-256 fingerprint is registered in D1 before email delivery.
3. The verification route decrypts and validates the token.
4. D1 confirms the fingerprint is registered, unexpired, and unused.
5. The verified identity is persisted.
6. A conditional update marks the fingerprint consumed exactly once.
7. Replay attempts are rejected.

## Staging activation

Create one isolated D1 database named:

```text
cosmicsphere-staging-db
```

Add its database ID to the GitHub `staging` environment as the secret:

```text
CLOUDFLARE_D1_DATABASE_ID
```

Do not paste the database ID into source files or chat. The existing Cloudflare deployment token must be permitted to edit Workers Scripts and D1 databases.

During staging deployment, the workflow:

1. generates a temporary Wrangler configuration;
2. adds exactly one D1 binding named `DB`;
3. applies committed migrations remotely;
4. deploys the CI-proven `main` commit; and
5. runs staging smoke checks.

Without `CLOUDFLARE_D1_DATABASE_ID`, staging remains in a controlled `account_persistence_not_configured` state and no account is created.

## Live verification

After a successful D1-enabled deployment:

- Google callback must show `Google account identity persisted`.
- Email callback must show `Email account identity persisted`.
- Repeating either verified identity must remain idempotent.
- Reusing an already-consumed email link must fail.
- No session cookie or authenticated authorization boundary should exist until ASTRO-125.

## Security boundary

ASTRO-124 does not:

- store Google access or refresh tokens;
- store clear email magic-link tokens;
- issue an authenticated session;
- enable account-protected product routes;
- perform automatic cross-account merges;
- reactivate deleted accounts;
- activate production D1.

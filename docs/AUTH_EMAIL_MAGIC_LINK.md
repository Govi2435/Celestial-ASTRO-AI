# Email magic-link authentication — ASTRO-123

- Jira: `KAN-18 / ASTRO-123`
- Runtime: Vinext on Cloudflare Workers
- Current environment: staging only
- Delivery provider: Resend HTTP API
- Account persistence: not active in this slice
- Authenticated sessions: not active in this slice

## Implemented routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/auth/email/start` | Show the staging email sign-in form |
| `POST` | `/api/auth/email/start` | Generate and deliver a secure magic link |
| `GET` | `/api/auth/email/verify?token=...` | Verify the encrypted link and browser transaction |

All routes return `404` outside `APP_ENV=staging`.

## Security contract

- Email addresses are normalized and bounded before use.
- Request bodies are limited to 4 KiB.
- Magic links expire after 10 minutes.
- Link payloads are encrypted and authenticated with AES-GCM.
- The email address is not exposed as clear text in the verification URL.
- A signed `__Host-` HttpOnly, Secure, SameSite=Lax browser cookie binds the link to the browser that requested it.
- The cookie is cleared after the first verification attempt.
- Unsafe cross-origin `returnTo` values are replaced with `/`.
- Resend requests use a per-link idempotency key.
- Provider redirects are rejected rather than followed with credentials.
- API keys, link tokens, authorization material, recipient email addresses, and provider response bodies are not logged.
- The request response does not claim that an account exists.

## Current limitation

This ASTRO-123 slice intentionally requires the link to be opened in the same browser that requested it. The browser transaction makes the staging link effectively one-use after the first verification attempt, but there is no durable server-side token-consumption record yet.

ASTRO-124 will add D1-backed account and identity persistence and can replace the browser-bound proof with hashed, durable, cross-device, single-use token consumption. ASTRO-125 will create authenticated sessions only after identity persistence exists.

## Cloudflare staging secrets

Add these encrypted Worker secrets to `cosmicsphere-staging`:

```text
RESEND_API_KEY
EMAIL_MAGIC_LINK_SECRET
```

Add this non-public configuration value as a secret or encrypted variable:

```text
EMAIL_MAGIC_LINK_FROM
```

Example sender format:

```text
Celestial ASTRO AI <login@auth.example.com>
```

`EMAIL_MAGIC_LINK_SECRET` must contain at least 32 bytes of unpredictable data. Do not reuse the Google OAuth cookie secret.

## Resend setup

1. Create a Resend API key with sending access restricted to the intended domain when possible.
2. Add and verify a domain or subdomain in Resend.
3. Use an address at that verified domain for `EMAIL_MAGIC_LINK_FROM`.
4. Add the three values to the Cloudflare staging Worker.
5. Redeploy staging from protected `main`.

Resend's current API endpoint used by the adapter is:

```text
POST https://api.resend.com/emails
```

The adapter sends `Authorization: Bearer ...`, JSON content, and an `Idempotency-Key` header.

## Manual staging verification

1. Open:

   ```text
   https://cosmicsphere-staging.govindapp2403.workers.dev/api/auth/email/start
   ```

2. Enter an email address you can access.
3. Keep that browser window open.
4. Open the delivered link in the same browser within 10 minutes.
5. Confirm the page shows:

   ```text
   Email identity verified
   ```

Refreshing or reusing the callback after the cookie has been cleared should fail and require a new link.

## Not implemented by ASTRO-123

- account creation or lookup;
- Google/email identity linking;
- D1 token rows;
- cross-device magic-link consumption;
- authenticated session creation;
- session rotation or revocation;
- central IP/email rate limiting;
- production activation.

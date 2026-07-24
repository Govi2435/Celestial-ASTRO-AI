# ASTRO-127 — CSRF and rate-limit controls

## Authenticated mutations

`POST /api/auth/sessions` and `POST /api/auth/logout` require all of the following:

- HTTPS.
- An exact same-origin `Origin` header.
- `Sec-Fetch-Site` equal to `same-origin` or `none` when present.
- A valid ASTRO-125 server session.
- `X-Celestial-CSRF` matching the SHA-256 hash stored for that session.

`GET /api/auth/sessions` issues a fresh 256-bit CSRF token. D1 stores only its SHA-256 hash. Successful session-management mutations rotate the token and return the replacement. Revoking a session clears its CSRF hash.

## Email sign-in form

`GET /api/auth/email/start` issues a random token in both:

- a hidden form field; and
- the host-only `__Host-celestial_email_csrf` cookie.

The cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, and has no `Domain`. The POST requires exact same-origin metadata and a constant-time match between the submitted field and cookie. The cookie is cleared after a successful request.

## Durable rate limits

The D1 `auth_rate_limits` table stores only:

- a SHA-256 base64url bucket hash;
- a bounded predefined scope;
- window timestamps;
- request count; and
- update time.

It never stores clear email addresses, IP addresses, account IDs, session cookies, session tokens, OAuth state, or magic-link tokens.

| Scope | Limit | Window | Key material before hashing |
|---|---:|---:|---|
| Google OAuth start | 20 | 10 minutes | Cloudflare client address |
| Email start client | 10 | 15 minutes | Cloudflare client address |
| Email start recipient | 5 | 60 minutes | normalized recipient email |
| Session mutation | 30 | 5 minutes | authenticated account ID |
| Logout | 20 | 5 minutes | account ID and session ID |

Counters update atomically through SQLite `INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING`. Rejections return HTTP 429 with `Retry-After` and bounded `RateLimit-*` headers.

## Failure behavior

- Cross-origin or missing CSRF data fails closed.
- Missing D1 persistence keeps protected routes unavailable.
- Unexpected rate-limit persistence errors fail closed instead of bypassing throttling.
- Logs contain bounded diagnostic codes only; no raw bucket material or CSRF values are logged.

# ADR-0022: Session-bound CSRF and durable hashed rate limits

## Status

Accepted.

## Context

ASTRO-126 protected session mutations with route-local origin checks. That boundary did not provide a synchronizer token, was duplicated across routes, and did not throttle login or session-management abuse across Worker instances.

## Decision

1. Centralize HTTPS, exact-origin, and Fetch Metadata checks in `app/request-security.ts`.
2. Issue random 256-bit CSRF tokens for authenticated sessions, persist only SHA-256 hashes on `auth_sessions`, and rotate the token after successful management mutations.
3. Use a host-only HttpOnly double-submit token for the anonymous email sign-in form.
4. Store fixed-window counters in D1 using only SHA-256 bucket hashes and bounded predefined scopes.
5. Update counters atomically and return HTTP 429 with bounded retry metadata.
6. Fail closed when security state cannot be verified or persisted.

## Consequences

- Cross-site requests cannot perform authenticated session mutations with ambient cookies alone.
- Session-cookie rotation does not break CSRF verification because CSRF state is bound to the durable session ID.
- Replayed successful mutation tokens fail after rotation.
- Limits apply consistently across Cloudflare Worker instances.
- D1 does not retain clear IP addresses, email addresses, session tokens, cookies, or CSRF tokens.
- The staging database requires migration `0005_p9_csrf_rate_limits.sql` before the new routes deploy.

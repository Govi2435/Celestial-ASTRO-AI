# ADR-0019: Secure server sessions

- Status: Accepted
- Date: 2026-07-24
- Scope: KAN-18 / ASTRO-125

## Context

ASTRO-122 through ASTRO-124 verify Google and email identities and persist durable Celestial accounts. The application now needs authenticated server state without storing provider access tokens or using self-contained bearer tokens that cannot be revoked centrally.

## Decision

Use opaque, server-side sessions stored in Cloudflare D1.

Each successful verified identity flow creates a new 256-bit random browser token. The browser receives it only in a `__Host-` HTTP-only secure cookie. D1 stores only its SHA-256 hash.

Sessions use:

- 24-hour idle expiry;
- 30-day absolute expiry;
- 15-minute opaque-token rotation;
- 5-minute activity refresh threshold;
- active-account validation on every server session check;
- explicit revocation and bounded audit events.

Rotation updates the token hash in place with a compare-and-swap condition on the previous hash. This invalidates the prior cookie immediately and prevents parallel requests from silently preserving an old token.

## Consequences

- Database compromise does not expose reusable session cookies.
- Sessions can be revoked immediately.
- Account deletion or suspension fails closed during validation.
- Multiple devices can hold independent sessions, enabling ASTRO-126 session-management UI.
- D1 is consulted for authenticated requests; later performance work may add a carefully bounded cache without changing the security contract.
- Full CSRF and rate-limit controls remain ASTRO-127.

## Rejected alternatives

### Provider access tokens as application sessions

Rejected because provider tokens have broader purpose, different revocation semantics and must not be stored for this product flow.

### Stateless signed JWT sessions

Rejected because immediate revocation, device-level session management and server-enforced account status would require additional state while increasing token disclosure impact.

### Clear session tokens in D1

Rejected because a database read would directly yield active bearer credentials.

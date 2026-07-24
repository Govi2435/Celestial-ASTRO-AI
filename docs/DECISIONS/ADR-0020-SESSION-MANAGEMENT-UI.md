# ADR-0020: Session-management UI

- **Status:** Accepted
- **Date:** 2026-07-24
- **Phase:** P9-C
- **Work item:** ASTRO-126

## Context

ASTRO-125 introduced secure, revocable, server-side sessions but exposed only a single-session validation endpoint and logout. KAN-18 requires users to view and revoke sessions without exposing credentials or allowing cross-account operations.

## Decision

Add a dedicated account console at `/account/sessions` backed by `GET` and `POST /api/auth/sessions`.

The console lists only active, non-expired sessions belonging to the authenticated account. It identifies the current session, displays bounded lifecycle metadata and supports revoking one other session or every other session. Current-session logout continues through `/api/auth/logout` so revocation and browser-cookie clearing remain one operation.

The API authenticates every request using the ASTRO-125 opaque cookie. Storage queries include the authenticated account identifier. Session IDs are validated, list results are capped at 25 and response DTOs omit clear tokens and token hashes.

## Consequences

### Positive

- Users can detect and terminate unexpected account access.
- Cross-account revocation is prevented by account-scoped D1 predicates.
- The current browser cannot accidentally revoke itself without clearing its cookie.
- No new database migration or secret is required.
- The UI is compatible with both Google and email-authenticated sessions.

### Trade-offs

- The current schema does not store device labels, IP addresses or user-agent data, so other sessions are intentionally described generically.
- Full reusable CSRF and rate-limit controls remain ASTRO-127; ASTRO-126 applies an immediate HTTPS and same-origin/site mutation gate.
- Session history is not shown; only currently active sessions are listed.

## Rejected alternatives

### Expose token fingerprints to identify devices

Rejected because token-derived identifiers provide no meaningful user value and increase credential-adjacent exposure.

### Allow the management endpoint to revoke the current session

Rejected because a successful current-session revocation must also clear the browser cookie. The dedicated logout route already guarantees both operations.

### List every historical session

Rejected for this milestone because the acceptance requirement is active-session control. Historical audit presentation can be designed separately with retention and privacy rules.

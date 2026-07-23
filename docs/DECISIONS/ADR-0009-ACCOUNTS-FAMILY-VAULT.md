# ADR-0009: Accounts and family vault

- Status: Accepted
- Phase: P6
- Profile: `celestial-account-vault-p6-v1`

## Decision

Celestial ASTRO AI may store account-owned family birth profiles only after explicit consent confirmation. Exact-time, approximate-time, and unknown-time semantics are preserved exactly; an unknown birth time is never replaced with an invented value.

Account data is isolated by account ID, exported without authentication secrets, and removed through a two-step deletion challenge. Deleting an account cascades to saved family profiles. Minimal audit events may record security and deletion actions but must not include raw birth details.

## Activation gate

The schema and domain controls are production-ready foundations, but public account activation remains blocked until a real identity provider, verified session middleware, D1 binding, migration deployment, CSRF protection, and per-account authorization tests are configured.

## Deletion contract

1. The owner requests deletion while authenticated.
2. The UI displays an account-specific phrase.
3. Confirmation must occur within 24 hours.
4. Active sessions are revoked before destructive deletion.
5. The account row is marked deleted or removed according to legal retention requirements.
6. Family profiles are deleted by database cascade.
7. Payment records, when introduced in P7, retain only legally required transaction references.

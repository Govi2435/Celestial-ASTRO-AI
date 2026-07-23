# ADR-0011: Professional astrologer dashboard

- Status: Accepted
- Phase: P8
- Profile: `celestial-professional-dashboard-p8-v1`

## Decision

Professional work is isolated in account-owned workspaces. Every case has a workspace, an assigned professional, an explicit lifecycle, and a client-consent record. Birth details and chart data must not be disclosed until consent is active.

Role permissions are intentionally narrow:

- owners administer the workspace;
- astrologers work only on assigned cases;
- assistants support permitted workflow operations;
- viewers are read-only.

Professional notes are private workspace records and are never reused as public interpretation evidence. Report delivery requires both active consent and a receipt/chart ID that matches the client case.

Appointments use a constrained state machine so completed or canceled bookings cannot silently return to active states. Security-sensitive actions must emit audit events without copying raw birth data into logs.

## Activation gate

The dashboard UI and public professional onboarding remain blocked until identity verification, professional terms, client consent UX, workspace authorization middleware, encrypted backups, audit retention, notification delivery, calendar integration, and legal/privacy review are complete.

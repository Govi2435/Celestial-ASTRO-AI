# Celestial ASTRO AI — Claim Integrity Policy

- Status: Source of truth
- Jira: `KAN-16 / ASTRO-104`
- Scope: README, product UI, metadata, reports, pitch material, API profiles, and release communication

This policy prevents roadmap ideas, internal tests, or code foundations from being marketed as active production capabilities.

## Current claim baseline

The current build may state that server-side calculations use Astronomy Engine `2.1.19`, the versioned mean Lahiri profile, whole-sign houses for timed charts, mean lunar nodes, historical timezone handling, honest birth-time uncertainty, calculation receipts, deterministic evidence-linked interpretation, and an on-demand direct-download PDF.

P6–P8 remain domain, migration, test, and ADR foundations. They are not live account, billing, or professional product surfaces.

## NASA/JPL reference language

Allowed:

> The internal regression suite compares 20 pinned apparent geocentric longitude fixtures with NASA/JPL Horizons DE441 data. The maximum observed delta in that pinned set is documented by the engine profile.

Required limitation:

> This is an internal fixture comparison. It is not NASA certification, third-party accreditation, proof of universal accuracy, or validation of astrology.

Never use `NASA-grade`, `NASA certified`, `NASA-powered astrology`, scientific proof of predictions, or accuracy claims broader than the documented kernel target and pinned fixture set.

## Swiss Ephemeris language

Swiss Ephemeris may be described only as a possible future calculation service subject to licensing, implementation, migration tests, and independent validation. Never state or imply that it powers the current public route.

## Artificial-intelligence language

Current truth:

```text
responseEngine: deterministic-evidence-router
generativeModel: none
```

Allowed terms include deterministic evidence router, approved rule engine, and evidence-linked chart questions. Never state or imply that the current feature uses an LLM, RAG, agent handoffs, multi-agent orchestration, model memory, or generative streaming.

## Privacy and production-security language

Current truth:

- calculation, question, and PDF routes do not persist application records;
- the PDF route returns a direct download and does not store the generated file;
- D1 and R2 bindings are not configured in the recorded hosting configuration;
- authentication, sessions, CSRF protection, tenant authorization, payment verification, and report-library access control are not active;
- P6–P8 are foundations rather than public account, billing, or professional surfaces.

Allowed terms include `current routes do not persist birth data`, `direct-download report`, `generated file is not stored by the current route`, and `account protection pending`.

Never claim end-to-end encryption, full production security, a live private vault, subscription-protected reports, enterprise readiness, legal compliance, zero-knowledge privacy, or tenant isolation before the implementation and tests exist.

The word `private` may describe the HTTP `Cache-Control: private` directive only when that protocol meaning is explicit. It must not imply authenticated ownership, encrypted storage, or tenant isolation.

## Internal-validation language

The P2 record is an internal reproducibility validation. Public copy should prefer `internal P2 validation`, `pinned reference regression suite`, `validation record`, or `internal checks passed`.

The stable schema and route may retain `certificate` identifiers for compatibility, but surrounding copy must state that the record is internal and not external accreditation.

## Feature activation rule

A model, migration, test, or ADR does not make a feature active. A customer-facing feature may be called active only when its route, identity boundary, authorization, persistence, UI, security tests, deployment binding, monitoring, and operating process are complete.

## Release checklist

1. Confirm engine and dependency versions.
2. Limit NASA/JPL wording to pinned internal comparisons.
3. Keep Swiss Ephemeris labelled future unless activated and validated.
4. Do not label deterministic routing as generative AI.
5. Do not market P6–P8 foundations as live surfaces.
6. Do not market the P5 download as account-secured or subscription-protected.
7. Require evidence for encryption, compliance, latency, security, and accuracy claims.
8. Label future capabilities as future, planned, gated, or experimental.
9. Keep the responsible-use disclaimer visible.
10. Run the claim-integrity regression test.

Update this policy whenever an engine, provider, identity system, storage binding, payment system, AI runtime, security control, validation process, or public surface becomes active.

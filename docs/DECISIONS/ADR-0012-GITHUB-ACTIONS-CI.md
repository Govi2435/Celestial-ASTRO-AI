# ADR-0012 — Core GitHub Actions CI

- Status: Accepted
- Date: 2026-07-24
- Jira: `KAN-17 / ASTRO-111`

## Context

The repository already has a verified local test command, but pull requests and pushes to `main` were not automatically tested. Production-sensitive work must not depend only on a developer running commands locally.

## Decision

Add `.github/workflows/ci.yml` as the first required GitHub Actions workflow.

The workflow:

- runs on every pull request;
- runs on pushes to `main`;
- supports manual dispatch;
- uses read-only repository permissions;
- checks out without persisting Git credentials;
- runs on `ubuntu-24.04`;
- pins Node.js `22.19.0`, which satisfies the repository requirement of Node.js `>=22.13.0`;
- installs dependencies with `npm ci` using `package-lock.json`;
- runs `npm test`, covering unit tests, the production build, and rendered HTML verification;
- cancels superseded runs for the same pull request or ref; and
- uses a 20-minute job timeout.

The workflow does not receive application, deployment, database, OAuth, payment, or AI secrets.

## Permanent regression control

`tests/ci-workflow.test.mjs` verifies the workflow triggers, least-privilege permissions, pinned runner/runtime, lockfile installation, and verified test command. It also rejects `pull_request_target` and direct secret use in this core workflow.

## Deferred work

ASTRO-111 establishes the core test workflow only. The following remain separate backlog items:

- ASTRO-112 — dedicated lint and type-check jobs;
- ASTRO-113 — migration drift validation;
- ASTRO-114 — test artifact upload;
- ASTRO-115 — branch protection and required-check enforcement; and
- ASTRO-116 — staging deployment flow.

Security/dependency scanning and production deployment remain outside this workflow until their operating and permission boundaries are approved.

## Consequences

Every new pull request now produces automated evidence that the existing verified suite passes on a clean GitHub-hosted Linux runner. Merging is not yet technically blocked on this check until ASTRO-115 configures branch protection.

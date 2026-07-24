# ADR-0013 — Migration Drift Validation

- Status: Accepted
- Date: 2026-07-24
- Jira: `KAN-17 / ASTRO-113`

## Context

The repository contains three ordered SQLite migrations that create 11 tables, while `db/schema.ts` currently declares only the three P6 Account & Family Vault tables. Full P7/P8 typed-schema parity belongs to P9-D and must not be claimed as complete during P9-B.

At the same time, pull requests need an automated way to detect accidental edits to committed migrations, invalid migration ordering, SQL that no longer applies cleanly, broken foreign keys, and changes to the resulting database schema.

## Decision

Add a repository-owned migration validator using Node.js `node:sqlite` and a reviewed manifest at `drizzle/migration-manifest.json`.

The validator:

- requires sequential four-digit migration prefixes beginning at `0000`;
- computes a whitespace-normalized SHA-256 for each migration;
- applies every migration in order to an in-memory SQLite database;
- enables foreign keys and runs `PRAGMA foreign_key_check`;
- builds a canonical fingerprint from tables, columns, indexes, and foreign keys;
- compares the fingerprint and migration list with the committed manifest;
- extracts typed table names from `db/schema.ts` and verifies they exist in the migrated database; and
- reports typed-schema parity as either `full` or `partial`.

Add a stable GitHub Actions check named `Migration drift` that runs `npm run db:validate` on pull requests and pushes to `main`.

## Baseline updates

Intentional migration changes require both the SQL migration and regenerated manifest to be reviewed in the same pull request:

```text
npm run db:baseline
npm run db:validate
```

CI never executes the baseline-writing command.

## Current parity statement

The accepted ASTRO-113 baseline is:

- 3 migration files;
- 11 migrated tables;
- 3 typed Drizzle tables; and
- `typedSchemaParity: "partial"`.

This is a drift-control baseline, not production schema parity. P9-D must add P7/P8 typed definitions and resolve documented integrity decisions before production migration activation.

## Consequences

Accidental migration mutation and final-schema drift now fail CI. Reviewers receive a stable schema digest and explicit manifest diff. The repository still does not have branch protection until ASTRO-115, and the validator does not connect to or modify any deployed D1 database.

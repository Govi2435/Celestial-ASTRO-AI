# Celestial ASTRO AI — Continuous Integration

- Status: Active CI, protected `main`, and automatic staging deployment
- Jira: `KAN-17 / ASTRO-111–ASTRO-116`
- Core workflow: `.github/workflows/ci.yml`
- Staging workflow: `.github/workflows/deploy-staging.yml`

## Current automated checks

The `CI` workflow runs on pull requests, pushes to `main`, and manual dispatch.

It exposes four independent jobs on clean GitHub-hosted Ubuntu runners with Node.js `22.19.0` and dependencies installed from the committed `package-lock.json`:

| Check | Command | Purpose |
| --- | --- | --- |
| `Lint` | `npm run lint` | Enforce the current ESLint and Next.js rules |
| `Type check` | `npm run typecheck` | Run strict TypeScript validation with no output |
| `Migration drift` | `npm run db:validate` | Replay committed migrations and compare their canonical schema with the reviewed baseline |
| `Unit, build, and rendered HTML` | `npm run test:ci` | Run unit/domain tests, production build, rendered HTML verification and validated test evidence |

The workflow has read-only repository permissions, does not persist checkout credentials, does not use production secrets, cancels superseded runs, and uses bounded job timeouts.

## Type-check contract

`npm run typecheck` executes the repository compiler configuration through:

```text
tsc --noEmit --pretty false
```

The existing `tsconfig.json` remains authoritative and already enables strict mode and no-emission behavior.

## Migration-drift contract

`npm run db:validate`:

1. requires migration filenames to be sequential from `0000`;
2. records normalized SHA-256 values for every committed SQL migration;
3. replays every migration in order against an in-memory SQLite database;
4. runs `PRAGMA foreign_key_check`;
5. fingerprints tables, columns, indexes, and foreign keys;
6. compares the final schema with `drizzle/migration-manifest.json`; and
7. verifies that every typed Drizzle table exists in the migrated database.

The current reviewed baseline contains 11 migrated tables and 3 typed Drizzle tables. This is deliberately recorded as **partial parity**. ASTRO-113 prevents silent drift; it does not claim that the P7/P8 schema-parity work assigned to P9-D is complete.

For an intentional reviewed migration change, regenerate the baseline with:

```text
npm run db:baseline
```

The SQL migration and manifest changes must be reviewed together. CI never runs the baseline-writing command.

## Test artifact contract

The test job runs `npm run test:ci`, which captures the existing `npm test` output without masking its exit code. After the test step finishes, CI validates and uploads a single artifact named:

```text
ci-test-evidence-<run-id>-<run-attempt>
```

The artifact contains only:

| File | Purpose |
| --- | --- |
| `test.log` | Complete console output from unit/domain tests, the production build, and rendered HTML verification |
| `summary.json` | Minimal execution metadata, outcome, exit code, duration, commit, ref, runner and Node version |

The artifact is uploaded on both successful and failed test runs so reviewers can inspect failure evidence. Retention is 14 days.

Before upload, `npm run artifact:validate` enforces all of the following:

- exactly the two approved files are present;
- no symbolic links or unexpected files are included;
- per-file and total size limits are respected;
- the summary schema and outcome are internally consistent; and
- recognizable API keys, access tokens, environment assignments and private-key material are rejected.

The workflow does not upload `.env` files, the full environment, dependency caches, `.next`, source maps, generated PDFs, database files, birth data or report content. Generated local evidence under `artifacts/` is ignored by Git.

## Enforced `main` branch protection

The reviewed policy is stored in `.github/policies/main-branch-protection.json` and was activated through GitHub Settings on 2026-07-24.

The live rule targets `main` and enforces:

- changes through pull requests;
- strict, up-to-date success from all four CI jobs;
- conversation resolution before merging;
- administrator enforcement with no bypass;
- no force pushes; and
- no branch deletion.

Required approving reviews remain disabled while the repository is solo-owned, preventing author self-lockout. See `docs/BRANCH_PROTECTION.md` for the full policy and recovery procedure.

## Active staging deployment

`.github/workflows/deploy-staging.yml` deploys an isolated Worker named `cosmicsphere-staging`.

Automatic deployment runs only after the core `CI` workflow succeeds for a push to protected `main` and repository variable `STAGING_DEPLOY_ENABLED` equals `true`. Manual dispatch from `main` remains available for controlled recovery.

The workflow:

- checks out the exact CI-proven commit;
- uses GitHub environment `staging`;
- requires only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`;
- builds and validates the vinext artifact;
- deploys with the repository-locked Wrangler CLI and `wrangler.staging.jsonc`;
- smoke tests `/` and `/api/certification`;
- records the returned deployment URL; and
- uploads secret-scanned deployment evidence for 14 days.

Activation was verified on 2026-07-24:

- workflow run: `30071674127`;
- source SHA: `a6d6855e2ef83c52013814bc0d9415ee7b3e24b3`;
- staging URL: `https://cosmicsphere-staging.govindapp2403.workers.dev`;
- deployment outcome: success;
- smoke outcome: success; and
- automatic staging variable: enabled.

The staging config has no production route, D1, R2, KV, Durable Object or service binding. Production promotion is not part of this workflow. See `docs/STAGING_DEPLOYMENT.md` for operation and rollback instructions.

## Current limitations

The following remain pending:

- production deployment and promotion;
- security and dependency scanning;
- full P7/P8 typed-schema parity and production migration execution.

These controls remain tracked in the later launch backlog and must not be described as active before their evidence exists.

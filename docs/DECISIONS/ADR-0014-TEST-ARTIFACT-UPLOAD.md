# ADR-0014 — Validated Test Artifact Upload

- Status: Accepted
- Date: 2026-07-24
- Jira: `KAN-17 / ASTRO-114`

## Context

The core CI workflow reports pass/fail status, but completed workflow logs alone are not a compact, durable evidence package for reviewers. Failed test runs especially need retained console output that can be downloaded without granting the test job access to production credentials or uploading the complete workspace.

Artifacts can also create a new disclosure risk if a workflow uploads environment files, generated private reports, database contents, tokens, source maps, caches or arbitrary directories. The artifact boundary therefore must be explicit and validated before upload.

## Decision

Capture the existing `npm test` output through `scripts/run-ci-test-evidence.sh` while preserving the original command exit code.

Create only two files under `artifacts/ci/test`:

- `test.log` — the complete verified-suite console output; and
- `summary.json` — minimal, allowlisted execution metadata.

Run `scripts/validate-ci-test-artifact.mjs` after the test command with `always()` semantics. Upload the directory only when validation succeeds, using `actions/upload-artifact@v7`.

The artifact:

- is named with the workflow run ID and attempt;
- is created for both passing and failing test runs;
- is retained for 14 days;
- fails when the expected files are missing;
- excludes hidden files;
- uses high compression; and
- does not require application, payment, database, OAuth or AI credentials.

## Safety validation

Before upload, the validator:

- permits only `summary.json` and `test.log`;
- rejects symbolic links and non-regular files;
- enforces per-file and total byte limits;
- verifies the summary schema, command, exit code and outcome;
- rejects unexpected metadata fields; and
- scans both files for recognizable API-key, access-token, environment-assignment and private-key patterns.

A failed safety validation prevents upload and fails the test job. The workflow never uploads `.env`, the complete environment, `.next`, build caches, generated PDFs, databases, birth data, report content or arbitrary workspace paths.

## Failure semantics

The test command is piped through `tee`, with Bash `pipefail` and `PIPESTATUS[0]` preserving the actual `npm test` result. Artifact creation must never turn a failed test run into a successful CI result.

The safety and upload steps use `always()` so failure evidence remains available when tests fail. The upload step additionally requires the safety validator to have succeeded.

## Retention

Fourteen days provides enough time for pull-request and incident review while reducing unnecessary long-term storage of logs. Repository or organization retention policy may impose a lower maximum.

## Consequences

Pull-request runs now provide downloadable, bounded test evidence. Artifact contents have a smaller and safer scope than the working directory. Branch protection remains pending under ASTRO-115, and broader build/security artifacts remain outside this task.

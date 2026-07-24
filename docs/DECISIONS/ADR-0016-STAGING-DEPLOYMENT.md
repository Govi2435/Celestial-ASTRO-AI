# ADR-0016 — Protected Staging Deployment

- Status: Accepted and active
- Date: 2026-07-24
- Jira: `KAN-17 / ASTRO-116`

## Context

ASTRO-111 through ASTRO-115 established automated CI, retained evidence and enforced `main` branch protection. The repository still lacked an isolated deployment path where the exact protected commit could be exercised on a real edge runtime before any production promotion.

The current product does not have active D1 or R2 bindings, production authentication, subscription enforcement, or a production deployment workflow. A staging implementation must not silently create those capabilities or receive unrelated OpenAI, Razorpay, OAuth or production-domain credentials.

## Decision

Add `.github/workflows/deploy-staging.yml` and deploy to a dedicated Cloudflare Worker named `cosmicsphere-staging` using `wrangler.staging.jsonc`.

Automatic deployment runs only after the `CI` workflow succeeds for a push to protected `main`, and only while repository variable `STAGING_DEPLOY_ENABLED` equals `true`. Manual dispatch from `main` remains available for controlled recovery.

The workflow checks out the CI-proven commit SHA, installs locked dependencies, builds and validates the vinext artifact, deploys through the repository-locked local Wrangler binary, smoke tests the homepage and certification API, and uploads bounded deployment evidence.

Wrangler structured output is captured through `WRANGLER_OUTPUT_FILE_PATH` and parsed by `scripts/read-wrangler-deploy-output.mjs`. The parser rejects a missing HTTPS target or a Worker name other than `cosmicsphere-staging`.

The initial activation attempt used `cloudflare/wrangler-action@v3`, which surfaced only a generic `npx` exit-code failure. The workflow now invokes `./node_modules/.bin/wrangler` directly so the complete Cloudflare diagnostic remains visible in the Actions log and the deployed URL is taken from Wrangler's structured output.

## Environment and credentials

The GitHub job targets environment `staging`. It requires only:

- `CLOUDFLARE_API_TOKEN`; and
- `CLOUDFLARE_ACCOUNT_ID`.

The token is scoped to the intended Cloudflare account and Worker deployment operations. No application or production secrets are required.

## Bindings and routing

The staging Worker uses:

- an `ASSETS` binding for `dist/client`; and
- an `IMAGES` binding for vinext image optimization.

It uses a workers.dev endpoint and defines no custom routes. It does not configure D1, R2, KV, Durable Objects, service bindings or production domains. Persistent staging resources require separate review.

## Evidence and failure semantics

Deployment and smoke failures remain real workflow failures. Evidence-writing and validation steps run with `always()` semantics and upload only `deployment.json` and `smoke.log` when safety validation succeeds. Retention is 14 days.

The workflow does not automatically roll back. Immediate rollback uses Cloudflare deployment history to restore the previously known-good version, followed by a repository fix through the protected pull-request flow.

## Activation evidence

ASTRO-116 became operationally active on 2026-07-24 after all launch conditions passed:

1. GitHub environment `staging` was restricted to `main`.
2. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` were configured as environment secrets.
3. Manual workflow run `30071674127` deployed source SHA `a6d6855e2ef83c52013814bc0d9415ee7b3e24b3`.
4. Worker `cosmicsphere-staging` deployed to `https://cosmicsphere-staging.govindapp2403.workers.dev`.
5. Homepage and `/api/certification` smoke checks passed.
6. Evidence artifact `staging-deployment-evidence-30071674127-1` passed safety validation.
7. Repository variable `STAGING_DEPLOY_ENABLED=true` was enabled for automatic releases after successful protected-main CI.

Production promotion remains out of scope.

## Consequences

The project now has a repeatable, active pre-production runtime check tied to the protected commit and CI evidence. Deployment credentials are isolated from core CI, production remains untouched, and future persistence or payment work cannot be represented as active merely because staging exists.

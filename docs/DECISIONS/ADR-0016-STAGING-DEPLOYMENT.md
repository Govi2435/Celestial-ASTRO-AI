# ADR-0016 — Protected Staging Deployment

- Status: Accepted implementation; live activation pending staging credentials
- Date: 2026-07-24
- Jira: `KAN-17 / ASTRO-116`

## Context

ASTRO-111 through ASTRO-115 established automated CI, retained evidence and enforced `main` branch protection. The repository still lacked an isolated deployment path where the exact protected commit could be exercised on a real edge runtime before any production promotion.

The current product does not have active D1 or R2 bindings, production authentication, subscription enforcement, or a production deployment workflow. A staging implementation must not silently create those capabilities or receive unrelated OpenAI, Razorpay, OAuth or production-domain credentials.

## Decision

Add `.github/workflows/deploy-staging.yml` and deploy to a dedicated Cloudflare Worker named `cosmicsphere-staging` using `wrangler.staging.jsonc`.

Automatic deployment runs only after the `CI` workflow succeeds for a push to protected `main`, and only while repository variable `STAGING_DEPLOY_ENABLED` equals `true`. Manual dispatch from `main` remains available for initial activation and controlled recovery.

The workflow checks out the CI-proven commit SHA, installs locked dependencies, builds and validates the vinext artifact, deploys through `cloudflare/wrangler-action@v3`, smoke tests the homepage and certification API, and uploads bounded deployment evidence.

## Environment and credentials

The GitHub job targets environment `staging`. It requires only:

- `CLOUDFLARE_API_TOKEN`; and
- `CLOUDFLARE_ACCOUNT_ID`.

The token must be narrowly scoped to the intended Cloudflare account and Worker deployment operations. No application or production secrets are required.

## Bindings and routing

The staging Worker uses:

- an `ASSETS` binding for `dist/client`; and
- an `IMAGES` binding for vinext image optimization.

It uses a workers.dev endpoint and defines no custom routes. It does not configure D1, R2, KV, Durable Objects, service bindings or production domains. Persistent staging resources require separate review.

## Evidence and failure semantics

Deployment and smoke failures remain real workflow failures. Evidence-writing and validation steps run with `always()` semantics and upload only `deployment.json` and `smoke.log` when safety validation succeeds. Retention is 14 days.

The workflow does not automatically roll back. Immediate rollback uses Cloudflare deployment history to restore the previously known-good version, followed by a repository fix through the protected pull-request flow.

## Activation boundary

Repository implementation is complete when the workflow, config, validation, smoke tests and documentation pass CI and merge. ASTRO-116 is operationally complete only after:

1. the GitHub `staging` environment has the two Cloudflare secrets;
2. a manual deployment from `main` succeeds;
3. smoke tests pass against the returned deployment URL;
4. the evidence artifact is reviewed; and
5. `STAGING_DEPLOY_ENABLED=true` is set when automatic deployment is approved.

Production promotion remains out of scope.

## Consequences

The project gains a repeatable pre-production runtime check tied to the protected commit and CI evidence. Deployment credentials are isolated from core CI, production remains untouched, and future persistence or payment work cannot be represented as active merely because staging exists.

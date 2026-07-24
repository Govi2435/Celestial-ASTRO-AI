# Celestial ASTRO AI — Staging Deployment

- Jira: `KAN-17 / ASTRO-116`
- Workflow: `.github/workflows/deploy-staging.yml`
- Worker: `cosmicsphere-staging`
- GitHub environment: `staging`
- Wrangler configuration: `wrangler.staging.jsonc`
- Production promotion: not part of this workflow

## Purpose

The staging workflow deploys the exact commit that passed the protected `main` CI workflow to a dedicated Cloudflare Worker. It does not deploy the Sites production project, use production routes, activate D1/R2, run database migrations, or receive Razorpay/OpenAI credentials.

## Deployment triggers

The workflow supports two paths:

1. **Automatic:** after the `CI` workflow completes successfully for a push to protected `main`, and only when repository variable `STAGING_DEPLOY_ENABLED` equals `true`.
2. **Manual:** `workflow_dispatch` from the `main` branch. Manual execution is available before automatic deployment is enabled so the first deployment can be verified safely.

Pull-request and non-`main` workflow runs cannot deploy.

## Required GitHub configuration

Create or open the GitHub environment named `staging` and add these environment secrets:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Short-lived or narrowly scoped token allowed to deploy Workers for the intended Cloudflare account |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the staging Worker |

Do not add production application secrets to this environment. In particular, the staging workflow does not require OpenAI, Razorpay, OAuth, D1, R2, email, or production-domain credentials.

After the first successful manual deployment, create repository variable:

```text
STAGING_DEPLOY_ENABLED=true
```

This enables automatic deployment after successful `main` CI runs. Set it to `false` or delete it to pause automatic staging deployment without editing the workflow.

## First activation

1. Create the GitHub `staging` environment.
2. Add the two Cloudflare environment secrets.
3. Open **Actions → Staging Deployment → Run workflow**.
4. Select branch `main`.
5. Run the workflow.
6. Confirm build, deployment and smoke steps succeed.
7. Download the `staging-deployment-evidence-*` artifact and confirm the source SHA and deployment URL.
8. Set `STAGING_DEPLOY_ENABLED=true` only after the manual deployment is accepted.

## Deployment controls

The workflow:

- checks out the exact protected `main` commit that passed CI;
- installs from `package-lock.json`;
- runs the verified vinext build;
- validates `dist/server/index.js`, `dist/client` and the packaged hosting manifest;
- refuses staging configuration containing production names, routes, D1, R2 or recognizable live credentials;
- deploys with the locked local `./node_modules/.bin/wrangler` binary and `wrangler.staging.jsonc`;
- captures Wrangler structured output and validates the returned staging Worker URL;
- records the deployment URL as the GitHub environment URL;
- smoke tests `/` and `/api/certification` over HTTPS;
- preserves full Wrangler errors directly in the Actions log;
- preserves real deployment and smoke failures; and
- uploads bounded, secret-scanned evidence for 14 days.

## Staging bindings

The current Worker has only the bindings required by the current vinext runtime:

- `ASSETS` mapped to `dist/client`; and
- `IMAGES` mapped to Cloudflare Images.

D1 and R2 remain absent because `.openai/hosting.json` still records both as `null`. Adding any persistent binding requires a separate reviewed task, isolated staging resources and an updated migration/privacy plan.

## Evidence artifact

Each attempted deployment uploads:

```text
staging-deployment-evidence-<run-id>-<run-attempt>
```

It contains only:

- `deployment.json` — environment, Worker name, source SHA, workflow IDs, deployment URL and step outcomes;
- `smoke.log` — homepage and certification smoke-test output.

The validator rejects unexpected files, symbolic links, oversized evidence, private keys and recognizable API-token patterns.

## Failure and rollback

When deployment fails:

1. inspect the failed step and the retained evidence artifact;
2. keep `STAGING_DEPLOY_ENABLED` false while investigating repeated failures;
3. fix the issue through a pull request and allow protected CI to run again;
4. rerun the staging workflow manually from `main`;
5. use the Cloudflare deployment history to restore the previously known-good Worker version when immediate rollback is required; and
6. record the incident and restored version in Jira.

This workflow never promotes staging to production. Production deployment requires a separate approved workflow, production environment, secrets, smoke tests and go/no-go evidence.

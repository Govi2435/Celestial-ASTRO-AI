import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { findDeployment, parseWranglerOutput } from "../scripts/read-wrangler-deploy-output.mjs";
import { prepareStagingWranglerConfig } from "../scripts/prepare-staging-wrangler-config.mjs";
import { assertSafeStagingConfig, loadStagingConfig } from "../scripts/validate-staging-deployment.mjs";

const workflow = readFileSync(new URL("../.github/workflows/deploy-staging.yml", import.meta.url), "utf8");
const smokeScript = readFileSync(new URL("../scripts/smoke-staging.mjs", import.meta.url), "utf8");
const config = loadStagingConfig(new URL("../wrangler.staging.jsonc", import.meta.url));
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("staging deploys only protected main after successful CI or manual main dispatch", () => {
  assert.match(workflow, /^name: Staging Deployment$/m);
  assert.match(workflow, /^  workflow_run:$/m);
  assert.match(workflow, /^      - CI$/m);
  assert.match(workflow, /^      - completed$/m);
  assert.match(workflow, /^      - main$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /workflow_run\.event == 'push'/);
  assert.match(workflow, /workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /vars\.STAGING_DEPLOY_ENABLED == 'true'/);
  assert.doesNotMatch(workflow, /pull_request_target/);
});

test("staging workflow uses least privilege and an isolated environment", () => {
  assert.match(workflow, /^permissions:\n  contents: read\n  deployments: write$/m);
  assert.match(workflow, /^      name: staging$/m);
  assert.match(workflow, /url: \$\{\{ steps\.deploy\.outputs\.deployment-url \}\}/);
  assert.match(workflow, /ref: \$\{\{ env\.DEPLOY_SHA \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /timeout-minutes: 25/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test("staging injects only the isolated D1 identifier and applies reviewed migrations", () => {
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /secrets\.CLOUDFLARE_D1_DATABASE_ID/);
  assert.match(workflow, /prepare-staging-wrangler-config\.mjs/);
  assert.match(workflow, /wrangler d1 migrations apply DB --remote/);
  assert.match(workflow, /steps\.staging_config\.outputs\.account-persistence == 'ready'/);
  assert.match(workflow, /wrangler deploy --config "\$\{\{ steps\.staging_config\.outputs\.config-path \}\}"/);
  assert.match(workflow, /WRANGLER_OUTPUT_FILE_PATH/);
  assert.doesNotMatch(workflow, /cloudflare\/wrangler-action/);
  assert.doesNotMatch(workflow, /OPENAI_API_KEY|RAZORPAY_KEY|GOOGLE_CLIENT_SECRET|EMAIL_MAGIC_LINK_SECRET|rzp_live|production/i);
});

test("staging serves built assets before invoking the Worker", () => {
  assert.equal(config.assets.run_worker_first, false);
  assert.doesNotMatch(JSON.stringify(config.assets), /true/);
});

test("runtime staging config resolves Worker, assets, and migrations from its own directory", () => {
  assert.doesNotThrow(() => assertSafeStagingConfig(config));
  assert.equal(Object.hasOwn(config, "d1_databases"), false);
  const directory = mkdtempSync(join(tmpdir(), "celestial-staging-config-"));
  try {
    const inputPath = join(directory, "input.json");
    const runtimeDirectory = join(directory, ".wrangler");
    const pendingPath = join(runtimeDirectory, "pending.json");
    const readyPath = join(runtimeDirectory, "ready.json");
    const migrationsPath = join(directory, "drizzle");
    const workerPath = join(directory, "dist/server/index.js");
    const assetsPath = join(directory, "dist/client");
    mkdirSync(runtimeDirectory);
    mkdirSync(migrationsPath, { recursive: true });
    mkdirSync(dirname(workerPath), { recursive: true });
    mkdirSync(assetsPath, { recursive: true });
    writeFileSync(inputPath, JSON.stringify(config));

    const pending = prepareStagingWranglerConfig({ inputPath, outputPath: pendingPath, databaseId: "" });
    assert.equal(pending.accountPersistence, "pending");
    const pendingConfig = JSON.parse(readFileSync(pendingPath, "utf8"));
    assert.equal(Object.hasOwn(pendingConfig, "d1_databases"), false);
    assert.doesNotThrow(() => assertSafeStagingConfig(pendingConfig, { allowRuntimePaths: true }));

    const ready = prepareStagingWranglerConfig({
      inputPath,
      outputPath: readyPath,
      databaseId: "11111111-2222-4333-8444-555555555555",
      migrationsPath,
    });
    assert.equal(ready.accountPersistence, "ready");
    const readyConfig = JSON.parse(readFileSync(readyPath, "utf8"));
    assert.doesNotThrow(() => assertSafeStagingConfig(readyConfig, { allowD1: true, allowRuntimePaths: true }));
    assert.deepEqual(readyConfig.d1_databases[0], {
      binding: "DB",
      database_name: "cosmicsphere-staging-db",
      database_id: "11111111-2222-4333-8444-555555555555",
      migrations_dir: "../drizzle",
    });
    assert.equal(resolve(dirname(readyPath), readyConfig.main), resolve(workerPath));
    assert.equal(resolve(dirname(readyPath), readyConfig.assets.directory), resolve(assetsPath));
    assert.equal(resolve(dirname(readyPath), readyConfig.d1_databases[0].migrations_dir), resolve(migrationsPath));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("structured Wrangler output produces the staging deployment URL", () => {
  const records = parseWranglerOutput([
    JSON.stringify({ type: "wrangler-session", version: 1 }),
    JSON.stringify({
      type: "deploy",
      worker_name: "cosmicsphere-staging",
      version_id: "version-123",
      targets: ["https://cosmicsphere-staging.example.workers.dev"],
    }),
  ].join("\n"));
  assert.deepEqual(findDeployment(records), {
    deploymentUrl: "https://cosmicsphere-staging.example.workers.dev",
    versionId: "version-123",
  });
  assert.throws(() => findDeployment([{ type: "deploy", worker_name: "cosmicsphere" }]), /HTTPS deployment target|Unexpected deployed Worker/);
});

test("staging validates, smoke tests, and retains bounded evidence", () => {
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /run: npm run staging:validate/);
  assert.match(workflow, /run staging smoke checks/i);
  assert.match(workflow, /npm run staging:smoke/);
  assert.match(workflow, /run: npm run staging:evidence/);
  assert.match(workflow, /run: npm run staging:evidence:validate/);
  assert.match(workflow, /uses: actions\/upload-artifact@v7/);
  assert.match(workflow, /retention-days: 14/);
  assert.match(workflow, /if-no-files-found: error/);
  assert.match(workflow, /include-hidden-files: false/);
});

test("staging smoke accepts configuration-pending or ready account persistence", () => {
  assert.match(smokeScript, /account_persistence_not_configured/);
  assert.match(smokeScript, /\/api\/auth\/google\/start/);
  assert.match(smokeScript, /\/api\/auth\/email\/start/);
  assert.match(smokeScript, /x-celestial-account-persistence/);
  assert.match(smokeScript, /__Host-celestial_google_oauth=/);
  assert.match(smokeScript, /__Host-celestial_auth_probe=/);
  assert.match(smokeScript, /SameSite=Lax/);
  assert.doesNotMatch(smokeScript, /console\.log\([^\n]*(cookiePair|setCookie)/);
});

test("repository exposes the staging operating commands", () => {
  assert.equal(packageJson.scripts["staging:validate"], "node scripts/validate-staging-deployment.mjs");
  assert.equal(packageJson.scripts["staging:smoke"], "node scripts/smoke-staging.mjs");
  assert.equal(packageJson.scripts["staging:evidence"], "node scripts/write-staging-evidence.mjs artifacts/staging/deployment.json");
  assert.equal(packageJson.scripts["staging:evidence:validate"], "node scripts/validate-staging-evidence.mjs artifacts/staging");
});

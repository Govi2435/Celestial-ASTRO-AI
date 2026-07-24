import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findDeployment,
  parseWranglerOutput,
} from "../scripts/read-wrangler-deploy-output.mjs";
import {
  assertSafeStagingConfig,
  loadStagingConfig,
} from "../scripts/validate-staging-deployment.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/deploy-staging.yml", import.meta.url),
  "utf8",
);
const smokeScript = readFileSync(
  new URL("../scripts/smoke-staging.mjs", import.meta.url),
  "utf8",
);
const config = loadStagingConfig(
  new URL("../wrangler.staging.jsonc", import.meta.url),
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

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

test("staging uses the locked local Wrangler CLI and only Cloudflare environment secrets", () => {
  assert.match(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.match(workflow, /WRANGLER_OUTPUT_FILE_PATH/);
  assert.match(workflow, /\.\/node_modules\/\.bin\/wrangler deploy --config wrangler\.staging\.jsonc/);
  assert.match(workflow, /read-wrangler-deploy-output\.mjs/);
  assert.doesNotMatch(workflow, /cloudflare\/wrangler-action/);
  assert.doesNotMatch(
    workflow,
    /OPENAI_API_KEY|RAZORPAY_KEY|GOOGLE_CLIENT_SECRET|GOOGLE_OAUTH_COOKIE_SECRET|rzp_live|production/i,
  );
});

test("structured Wrangler output produces the staging deployment URL", () => {
  const records = parseWranglerOutput(
    [
      JSON.stringify({ type: "wrangler-session", version: 1 }),
      JSON.stringify({
        type: "deploy",
        worker_name: "cosmicsphere-staging",
        version_id: "version-123",
        targets: ["https://cosmicsphere-staging.example.workers.dev"],
      }),
    ].join("\n"),
  );

  assert.deepEqual(findDeployment(records), {
    deploymentUrl: "https://cosmicsphere-staging.example.workers.dev",
    versionId: "version-123",
  });

  assert.throws(
    () => findDeployment([{ type: "deploy", worker_name: "cosmicsphere" }]),
    /HTTPS deployment target|Unexpected deployed Worker/,
  );
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

test("staging smoke verifies the authentication compatibility contract", () => {
  assert.match(smokeScript, /\/api\/auth\/compatibility/);
  assert.match(smokeScript, /__Host-celestial_auth_probe=/);
  assert.match(smokeScript, /method: "POST"/);
  assert.match(smokeScript, /method: "DELETE"/);
  assert.match(smokeScript, /SameSite=Lax/);
  assert.match(smokeScript, /cookieRoundTrip/);
  assert.match(smokeScript, /tokenHashing/);
  assert.match(smokeScript, /mode=redirect/);
  assert.doesNotMatch(smokeScript, /console\.log\([^\n]*(cookiePair|setCookie)/);
});

test("staging smoke verifies Google OAuth configuration or a safe authorization redirect", () => {
  assert.match(smokeScript, /\/api\/auth\/google\/start/);
  assert.match(smokeScript, /google_oauth_not_configured/);
  assert.match(smokeScript, /https:\/\/accounts\.google\.com/);
  assert.match(smokeScript, /\/o\/oauth2\/v2\/auth/);
  assert.match(smokeScript, /code_challenge_method/);
  assert.match(smokeScript, /__Host-celestial_google_oauth=/);
  assert.match(smokeScript, /SameSite=Lax/);
  assert.doesNotMatch(smokeScript, /GOOGLE_CLIENT_SECRET|GOOGLE_OAUTH_COOKIE_SECRET/);
});

test("Wrangler staging config is isolated and has only current bindings", () => {
  assert.doesNotThrow(() => assertSafeStagingConfig(config));
  assert.equal(config.name, "cosmicsphere-staging");
  assert.equal(config.workers_dev, true);
  assert.equal(config.assets.binding, "ASSETS");
  assert.equal(config.images.binding, "IMAGES");
  assert.equal(Object.hasOwn(config, "d1_databases"), false);
  assert.equal(Object.hasOwn(config, "r2_buckets"), false);
  assert.equal(Object.hasOwn(config, "routes"), false);

  assert.throws(
    () => assertSafeStagingConfig({ ...config, name: "cosmicsphere" }),
    /cosmicsphere-staging/,
  );
});

test("repository exposes the staging operating commands", () => {
  assert.equal(
    packageJson.scripts["staging:validate"],
    "node scripts/validate-staging-deployment.mjs",
  );
  assert.equal(
    packageJson.scripts["staging:smoke"],
    "node scripts/smoke-staging.mjs",
  );
  assert.equal(
    packageJson.scripts["staging:evidence"],
    "node scripts/write-staging-evidence.mjs artifacts/staging/deployment.json",
  );
  assert.equal(
    packageJson.scripts["staging:evidence:validate"],
    "node scripts/validate-staging-evidence.mjs artifacts/staging",
  );
});

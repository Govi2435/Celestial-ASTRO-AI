import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve(process.argv[2] ?? "artifacts/staging/deployment.json");
const deploymentUrl = process.env.STAGING_BASE_URL ?? "";
const deployOutcome = process.env.DEPLOY_OUTCOME ?? "unknown";
const smokeOutcome = process.env.SMOKE_OUTCOME ?? "unknown";
const sourceSha = process.env.DEPLOY_SHA ?? process.env.GITHUB_SHA ?? "";

assert.match(sourceSha, /^[0-9a-f]{40}$/i, "Deployment evidence requires a full commit SHA.");
assert.ok(
  ["success", "failure", "cancelled", "skipped", "unknown"].includes(deployOutcome),
  "Unexpected deploy outcome.",
);
assert.ok(
  ["success", "failure", "cancelled", "skipped", "unknown"].includes(smokeOutcome),
  "Unexpected smoke outcome.",
);

if (deploymentUrl) {
  const url = new URL(deploymentUrl);
  assert.equal(url.protocol, "https:", "Deployment evidence URL must use HTTPS.");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
}

const evidence = {
  schemaVersion: 1,
  environment: "staging",
  workerName: "cosmicsphere-staging",
  sourceSha,
  sourceCiRunId: process.env.SOURCE_CI_RUN_ID ?? "",
  deploymentWorkflowRunId: process.env.GITHUB_RUN_ID ?? "",
  deploymentWorkflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
  deploymentUrl,
  deployOutcome,
  smokeOutcome,
  generatedAt: new Date().toISOString(),
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});
console.log(`[staging-evidence] wrote ${outputPath}`);

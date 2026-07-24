import assert from "node:assert/strict";
import { lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const root = resolve(process.argv[2] ?? "artifacts/staging");
const allowedFiles = new Set(["deployment.json", "smoke.log"]);
const maximumFileBytes = 2 * 1024 * 1024;
const maximumTotalBytes = 3 * 1024 * 1024;
const secretPatterns = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\brzp_(?:test|live)_[A-Za-z0-9]{8,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|OPENAI_API_KEY|RAZORPAY_KEY_SECRET)\s*[:=]\s*["']?[^\s"']{8,}/,
];

const entries = readdirSync(root, { withFileTypes: true });
const files = [];
for (const entry of entries) {
  const absolutePath = join(root, entry.name);
  const metadata = lstatSync(absolutePath);
  assert.equal(metadata.isSymbolicLink(), false, `Staging evidence must not contain symlinks: ${entry.name}`);
  assert.equal(entry.isFile(), true, `Staging evidence must contain regular files only: ${entry.name}`);
  files.push(absolutePath);
}

const relativeFiles = files
  .map((file) => relative(root, file).split(sep).join("/"))
  .sort();
assert.deepEqual(relativeFiles, ["deployment.json", "smoke.log"]);

let totalBytes = 0;
for (const file of files) {
  const relativePath = relative(root, file).split(sep).join("/");
  assert.ok(allowedFiles.has(relativePath), `Unexpected staging evidence file: ${relativePath}`);
  const size = statSync(file).size;
  assert.ok(size <= maximumFileBytes, `${relativePath} exceeds the per-file size limit.`);
  totalBytes += size;
  const content = readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    assert.equal(pattern.test(content), false, `${relativePath} contains possible secret material.`);
  }
}
assert.ok(totalBytes <= maximumTotalBytes, "Staging evidence exceeds the total size limit.");

const evidence = JSON.parse(readFileSync(join(root, "deployment.json"), "utf8"));
assert.deepEqual(
  Object.keys(evidence).sort(),
  [
    "deployOutcome",
    "deploymentUrl",
    "deploymentWorkflowRunAttempt",
    "deploymentWorkflowRunId",
    "environment",
    "generatedAt",
    "schemaVersion",
    "smokeOutcome",
    "sourceCiRunId",
    "sourceSha",
    "workerName",
  ].sort(),
);
assert.equal(evidence.schemaVersion, 1);
assert.equal(evidence.environment, "staging");
assert.equal(evidence.workerName, "cosmicsphere-staging");
assert.match(evidence.sourceSha, /^[0-9a-f]{40}$/i);
assert.ok(!Number.isNaN(Date.parse(evidence.generatedAt)));

if (evidence.deploymentUrl) {
  const url = new URL(evidence.deploymentUrl);
  assert.equal(url.protocol, "https:");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
}

console.log(
  `[staging-evidence] validated files=${relativeFiles.join(",")} bytes=${totalBytes} deploy=${evidence.deployOutcome} smoke=${evidence.smokeOutcome}`,
);

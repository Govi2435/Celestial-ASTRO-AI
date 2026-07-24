import assert from "node:assert/strict";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const allowedFiles = new Set(["summary.json", "test.log"]);
const allowedSummaryKeys = new Set([
  "schemaVersion",
  "command",
  "outcome",
  "exitCode",
  "durationSeconds",
  "generatedAt",
  "repository",
  "commitSha",
  "ref",
  "eventName",
  "runId",
  "runAttempt",
  "runnerOs",
  "nodeVersion",
]);
const maximumFileBytes = 12 * 1024 * 1024;
const maximumTotalBytes = 16 * 1024 * 1024;

const secretPatterns = [
  { label: "OpenAI-style API key", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { label: "Razorpay key ID", pattern: /\brzp_(?:test|live)_[A-Za-z0-9]{8,}\b/ },
  { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  {
    label: "private key material",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    label: "sensitive environment assignment",
    pattern:
      /\b(?:OPENAI_API_KEY|RAZORPAY_KEY_ID|RAZORPAY_KEY_SECRET|GITHUB_TOKEN)\s*[:=]\s*["']?[^\s"']{8,}/,
  },
];

function listFiles(rootDirectory, currentDirectory = rootDirectory) {
  const entries = readdirSync(currentDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(currentDirectory, entry.name);
    const metadata = lstatSync(absolutePath);

    assert.equal(
      metadata.isSymbolicLink(),
      false,
      `Artifact content must not contain symbolic links: ${relative(rootDirectory, absolutePath)}`,
    );

    if (entry.isDirectory()) {
      files.push(...listFiles(rootDirectory, absolutePath));
      continue;
    }

    assert.equal(
      entry.isFile(),
      true,
      `Artifact content must contain regular files only: ${relative(rootDirectory, absolutePath)}`,
    );
    files.push(absolutePath);
  }

  return files;
}

function normalizeRelativePath(rootDirectory, filePath) {
  return relative(rootDirectory, filePath).split(sep).join("/");
}

function scanForSecrets(fileName, content) {
  for (const { label, pattern } of secretPatterns) {
    assert.equal(
      pattern.test(content),
      false,
      `${fileName} contains possible ${label}; refusing artifact upload.`,
    );
  }
}

function validateSummary(summaryText) {
  const summary = JSON.parse(summaryText);

  assert.equal(summary.schemaVersion, 1, "Artifact schemaVersion must be 1.");
  assert.equal(summary.command, "npm test", "Artifact command must remain 'npm test'.");
  assert.ok(
    summary.outcome === "success" || summary.outcome === "failure",
    "Artifact outcome must be success or failure.",
  );
  assert.ok(Number.isInteger(summary.exitCode), "Artifact exitCode must be an integer.");
  assert.ok(summary.exitCode >= 0, "Artifact exitCode must be non-negative.");
  assert.equal(
    summary.outcome,
    summary.exitCode === 0 ? "success" : "failure",
    "Artifact outcome must match exitCode.",
  );
  assert.ok(
    Number.isInteger(summary.durationSeconds) && summary.durationSeconds >= 0,
    "Artifact durationSeconds must be a non-negative integer.",
  );
  assert.ok(
    !Number.isNaN(Date.parse(summary.generatedAt)),
    "Artifact generatedAt must be an ISO-compatible timestamp.",
  );

  for (const key of Object.keys(summary)) {
    assert.ok(
      allowedSummaryKeys.has(key),
      `Artifact summary contains an unexpected field: ${key}`,
    );
  }

  return summary;
}

export function validateCiTestArtifact(directoryPath) {
  const rootDirectory = resolve(directoryPath);
  const rootMetadata = statSync(rootDirectory);
  assert.equal(rootMetadata.isDirectory(), true, "Artifact path must be a directory.");

  const files = listFiles(rootDirectory);
  const relativeFiles = files.map((filePath) =>
    normalizeRelativePath(rootDirectory, filePath),
  );

  assert.deepEqual(
    [...relativeFiles].sort(),
    [...allowedFiles].sort(),
    "Artifact directory must contain only summary.json and test.log.",
  );

  let totalBytes = 0;
  for (const filePath of files) {
    const fileName = normalizeRelativePath(rootDirectory, filePath);
    const size = statSync(filePath).size;
    assert.ok(
      size <= maximumFileBytes,
      `${fileName} exceeds the ${maximumFileBytes}-byte safety limit.`,
    );
    totalBytes += size;
  }
  assert.ok(
    totalBytes <= maximumTotalBytes,
    `Artifact exceeds the ${maximumTotalBytes}-byte total safety limit.`,
  );

  const testLog = readFileSync(join(rootDirectory, "test.log"), "utf8");
  const summaryText = readFileSync(join(rootDirectory, "summary.json"), "utf8");
  assert.ok(testLog.trim().length > 0, "Artifact test.log must not be empty.");

  scanForSecrets("test.log", testLog);
  scanForSecrets("summary.json", summaryText);
  const summary = validateSummary(summaryText);

  return {
    directory: rootDirectory,
    files: relativeFiles.sort(),
    totalBytes,
    outcome: summary.outcome,
    exitCode: summary.exitCode,
  };
}

function main() {
  const directoryPath = process.argv[2];
  if (!directoryPath) {
    throw new Error("Usage: node scripts/validate-ci-test-artifact.mjs <directory>");
  }

  const result = validateCiTestArtifact(directoryPath);
  console.log(
    `[ci-artifact] Safe to upload ${basename(result.directory)} (${result.totalBytes} bytes, ${result.outcome}).`,
  );
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    main();
  } catch (error) {
    console.error(
      `[ci-artifact] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

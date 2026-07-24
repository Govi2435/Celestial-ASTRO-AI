import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

test("core CI runs for pull requests, main pushes, and manual dispatch", () => {
  assert.match(workflow, /^name: CI$/m);
  assert.match(workflow, /^  pull_request:$/m);
  assert.match(workflow, /^  push:$/m);
  assert.match(workflow, /^      - main$/m);
  assert.match(workflow, /^  workflow_dispatch:$/m);
  assert.doesNotMatch(workflow, /pull_request_target/);
});

test("core CI uses least privilege and a pinned supported runtime", () => {
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.match(workflow, /uses: actions\/checkout@v6/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /uses: actions\/setup-node@v6/);
  assert.match(workflow, /node-version: 22\.19\.0/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /timeout-minutes: 20/);
  assert.doesNotMatch(workflow, /\$\{\{\s*secrets\./);
});

test("core CI installs from the lockfile and runs the verified suite", () => {
  assert.match(workflow, /cache-dependency-path: package-lock\.json/);
  assert.match(workflow, /run: npm ci --no-audit --no-fund/);
  assert.match(workflow, /run: npm test/);
});

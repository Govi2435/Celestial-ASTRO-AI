import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
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

test("CI exposes independent lint, type-check, and test jobs", () => {
  assert.match(workflow, /^  lint:\n    name: Lint$/m);
  assert.match(workflow, /^  typecheck:\n    name: Type check$/m);
  assert.match(workflow, /^  test:\n    name: Unit, build, and rendered HTML$/m);
  assert.match(workflow, /run: npm run lint/);
  assert.match(workflow, /run: npm run typecheck/);
  assert.match(workflow, /run: npm test/);
});

test("quality commands use the repository lint and strict no-emit contracts", () => {
  assert.match(packageJson.scripts.lint, /eslint/);
  assert.match(packageJson.scripts.typecheck, /tsc --noEmit --pretty false/);
});

test("all CI jobs install from the committed lockfile", () => {
  assert.equal(
    (workflow.match(/cache-dependency-path: package-lock\.json/g) ?? []).length,
    3,
  );
  assert.equal(
    (workflow.match(/run: npm ci --no-audit --no-fund/g) ?? []).length,
    3,
  );
});

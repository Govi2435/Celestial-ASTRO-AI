import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateCiTestArtifact } from "../scripts/validate-ci-test-artifact.mjs";

function createArtifact({ log = "All verified checks passed.\n", exitCode = 0 } = {}) {
  const root = mkdtempSync(join(tmpdir(), "celestial-ci-artifact-"));
  const artifactDirectory = join(root, "artifacts", "ci", "test");
  mkdirSync(artifactDirectory, { recursive: true });
  writeFileSync(join(artifactDirectory, "test.log"), log, "utf8");
  writeFileSync(
    join(artifactDirectory, "summary.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        command: "npm test",
        outcome: exitCode === 0 ? "success" : "failure",
        exitCode,
        durationSeconds: 4,
        generatedAt: "2026-07-24T00:00:00.000Z",
        repository: "Govi2435/Celestial-ASTRO-AI",
        commitSha: "abc123",
        ref: "refs/pull/12/merge",
        eventName: "pull_request",
        runId: "1",
        runAttempt: "1",
        runnerOs: "Linux",
        nodeVersion: "v22.19.0",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  return { root, artifactDirectory };
}

test("safe test evidence is accepted", () => {
  const fixture = createArtifact();
  try {
    const result = validateCiTestArtifact(fixture.artifactDirectory);
    assert.deepEqual(result.files, ["summary.json", "test.log"]);
    assert.equal(result.outcome, "success");
    assert.equal(result.exitCode, 0);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("unexpected files are rejected", () => {
  const fixture = createArtifact();
  try {
    writeFileSync(join(fixture.artifactDirectory, ".env"), "EXAMPLE=value\n");
    assert.throws(
      () => validateCiTestArtifact(fixture.artifactDirectory),
      /must contain only summary\.json and test\.log/,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("secret-like values are rejected before upload", () => {
  const simulatedKey = ["sk", "proj", "a".repeat(32)].join("-");
  const fixture = createArtifact({ log: `accidental output: ${simulatedKey}\n` });
  try {
    assert.throws(
      () => validateCiTestArtifact(fixture.artifactDirectory),
      /possible OpenAI-style API key/,
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("failure evidence remains valid when outcome matches exit code", () => {
  const fixture = createArtifact({ log: "A test failed.\n", exitCode: 1 });
  try {
    const result = validateCiTestArtifact(fixture.artifactDirectory);
    assert.equal(result.outcome, "failure");
    assert.equal(result.exitCode, 1);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

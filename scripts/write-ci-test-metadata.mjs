import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseInteger(value, label) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

const [outputPathArgument, exitCodeArgument, startedArgument, finishedArgument] =
  process.argv.slice(2);

if (!outputPathArgument) {
  throw new Error("An output path is required.");
}

const exitCode = parseInteger(exitCodeArgument, "Exit code");
const startedAtEpoch = parseInteger(startedArgument, "Start time");
const finishedAtEpoch = parseInteger(finishedArgument, "Finish time");

if (finishedAtEpoch < startedAtEpoch) {
  throw new Error("Finish time cannot be before start time.");
}

const summary = {
  schemaVersion: 1,
  command: "npm test",
  outcome: exitCode === 0 ? "success" : "failure",
  exitCode,
  durationSeconds: finishedAtEpoch - startedAtEpoch,
  generatedAt: new Date().toISOString(),
  repository: process.env.GITHUB_REPOSITORY ?? null,
  commitSha: process.env.GITHUB_SHA ?? null,
  ref: process.env.GITHUB_REF ?? null,
  eventName: process.env.GITHUB_EVENT_NAME ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  runnerOs: process.env.RUNNER_OS ?? process.platform,
  nodeVersion: process.version,
};

const outputPath = resolve(outputPathArgument);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, {
  encoding: "utf8",
  mode: 0o600,
});

console.log(`[ci-artifact] Wrote metadata to ${outputPath}.`);

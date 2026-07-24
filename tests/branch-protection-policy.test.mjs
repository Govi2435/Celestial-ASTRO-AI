import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertProtectionMatches,
  buildProtectionPayload,
} from "../scripts/configure-main-protection.mjs";

const policy = JSON.parse(
  readFileSync(
    new URL("../.github/policies/main-branch-protection.json", import.meta.url),
    "utf8",
  ),
);
const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

const expectedChecks = [
  "Lint",
  "Type check",
  "Migration drift",
  "Unit, build, and rendered HTML",
];

test("main protection policy requires the four active CI job names", () => {
  assert.equal(policy.repository, "Govi2435/Celestial-ASTRO-AI");
  assert.equal(policy.branch, "main");
  assert.deepEqual(policy.requiredStatusChecks, expectedChecks);

  for (const check of expectedChecks) {
    assert.match(workflow, new RegExp(`name: ${check.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("main protection policy prevents direct unsafe updates", () => {
  assert.equal(policy.requirePullRequest, true);
  assert.equal(policy.requiredApprovingReviewCount, 0);
  assert.equal(policy.requireBranchesToBeUpToDate, true);
  assert.equal(policy.requireConversationResolution, true);
  assert.equal(policy.enforceAdmins, true);
  assert.equal(policy.allowForcePushes, false);
  assert.equal(policy.allowDeletions, false);
  assert.equal(policy.lockBranch, false);
});

test("branch protection payload maps the reviewed policy", () => {
  const payload = buildProtectionPayload(policy);

  assert.deepEqual(payload.required_status_checks, {
    strict: true,
    contexts: expectedChecks,
  });
  assert.equal(payload.enforce_admins, true);
  assert.equal(
    payload.required_pull_request_reviews.required_approving_review_count,
    0,
  );
  assert.equal(payload.required_conversation_resolution, true);
  assert.equal(payload.allow_force_pushes, false);
  assert.equal(payload.allow_deletions, false);
  assert.equal(payload.restrictions, null);
});

test("verification rejects drift from the reviewed policy", () => {
  const matching = {
    required_status_checks: { strict: true, contexts: expectedChecks },
    enforce_admins: { enabled: true },
    required_pull_request_reviews: {
      required_approving_review_count: 0,
      dismiss_stale_reviews: false,
      require_code_owner_reviews: false,
      require_last_push_approval: false,
    },
    required_conversation_resolution: { enabled: true },
    required_linear_history: { enabled: false },
    allow_force_pushes: { enabled: false },
    allow_deletions: { enabled: false },
    block_creations: { enabled: false },
    lock_branch: { enabled: false },
    allow_fork_syncing: { enabled: false },
  };

  assert.doesNotThrow(() => assertProtectionMatches(matching, policy));
  assert.throws(() =>
    assertProtectionMatches(
      {
        ...matching,
        required_status_checks: {
          strict: true,
          contexts: expectedChecks.filter((check) => check !== "Migration drift"),
        },
      },
      policy,
    ),
  );
});

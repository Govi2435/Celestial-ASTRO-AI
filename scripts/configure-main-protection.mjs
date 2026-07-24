import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const policyUrl = new URL(
  "../.github/policies/main-branch-protection.json",
  import.meta.url,
);
const policy = JSON.parse(readFileSync(policyUrl, "utf8"));
const apiVersion = "2022-11-28";

function protectionUrl() {
  const [owner, repository] = policy.repository.split("/");
  assert.ok(owner && repository, "Policy repository must use owner/name format.");
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/branches/${encodeURIComponent(policy.branch)}/protection`;
}

export function buildProtectionPayload(input = policy) {
  assert.equal(input.schemaVersion, 1, "Unsupported branch-protection policy version.");
  assert.ok(Array.isArray(input.requiredStatusChecks));
  assert.ok(input.requiredStatusChecks.length > 0);

  return {
    required_status_checks: {
      strict: input.requireBranchesToBeUpToDate,
      contexts: input.requiredStatusChecks,
    },
    enforce_admins: input.enforceAdmins,
    required_pull_request_reviews: input.requirePullRequest
      ? {
          dismiss_stale_reviews: input.dismissStaleReviews,
          require_code_owner_reviews: input.requireCodeOwnerReviews,
          required_approving_review_count: input.requiredApprovingReviewCount,
          require_last_push_approval: input.requireLastPushApproval,
        }
      : null,
    restrictions: null,
    required_linear_history: input.requireLinearHistory,
    allow_force_pushes: input.allowForcePushes,
    allow_deletions: input.allowDeletions,
    block_creations: input.blockCreations,
    required_conversation_resolution: input.requireConversationResolution,
    lock_branch: input.lockBranch,
    allow_fork_syncing: input.allowForkSyncing,
  };
}

function enabled(value) {
  return typeof value === "object" && value !== null ? value.enabled : value;
}

export function assertProtectionMatches(actual, input = policy) {
  assert.equal(actual.required_status_checks?.strict, input.requireBranchesToBeUpToDate);
  assert.deepEqual(
    [...(actual.required_status_checks?.contexts ?? [])].sort(),
    [...input.requiredStatusChecks].sort(),
  );
  assert.equal(enabled(actual.enforce_admins), input.enforceAdmins);
  assert.equal(
    actual.required_pull_request_reviews?.required_approving_review_count,
    input.requiredApprovingReviewCount,
  );
  assert.equal(
    actual.required_pull_request_reviews?.dismiss_stale_reviews,
    input.dismissStaleReviews,
  );
  assert.equal(
    actual.required_pull_request_reviews?.require_code_owner_reviews,
    input.requireCodeOwnerReviews,
  );
  assert.equal(
    actual.required_pull_request_reviews?.require_last_push_approval,
    input.requireLastPushApproval,
  );
  assert.equal(
    enabled(actual.required_conversation_resolution),
    input.requireConversationResolution,
  );
  assert.equal(enabled(actual.required_linear_history), input.requireLinearHistory);
  assert.equal(enabled(actual.allow_force_pushes), input.allowForcePushes);
  assert.equal(enabled(actual.allow_deletions), input.allowDeletions);
  assert.equal(enabled(actual.block_creations), input.blockCreations);
  assert.equal(enabled(actual.lock_branch), input.lockBranch);
  assert.equal(enabled(actual.allow_fork_syncing), input.allowForkSyncing);
}

async function githubRequest(method, token, body) {
  const response = await fetch(protectionUrl(), {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": apiVersion,
      "User-Agent": "celestial-astro-ai-branch-protection",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  const responseBody = responseText ? JSON.parse(responseText) : {};

  if (!response.ok) {
    const message = responseBody.message ?? `${response.status} ${response.statusText}`;
    throw new Error(`GitHub branch-protection request failed: ${message}`);
  }

  return responseBody;
}

async function main() {
  const mode = process.argv[2] ?? "verify";
  assert.ok(mode === "apply" || mode === "verify", "Use apply or verify.");

  const token = process.env.GITHUB_ADMIN_TOKEN ?? process.env.GH_TOKEN;
  assert.ok(
    token,
    "Set GITHUB_ADMIN_TOKEN or GH_TOKEN to a GitHub token with repository Administration write access.",
  );

  if (mode === "apply") {
    await githubRequest("PUT", token, buildProtectionPayload());
    console.log(`[branch-protection] Applied policy to ${policy.repository}:${policy.branch}.`);
  }

  const actual = await githubRequest("GET", token);
  assertProtectionMatches(actual);
  console.log(
    `[branch-protection] Verified ${policy.requiredStatusChecks.length} required checks on ${policy.branch}.`,
  );
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(
      `[branch-protection] ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}

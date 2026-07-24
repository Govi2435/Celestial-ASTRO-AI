# ADR-0015 — Main Branch Protection

- Status: Accepted and active
- Date: 2026-07-24
- Jira: `KAN-17 / ASTRO-115`

## Context

ASTRO-111 through ASTRO-114 established four stable GitHub Actions checks and retained test evidence, but successful checks do not prevent an administrator or collaborator from pushing directly to `main` or merging a failing pull request unless GitHub repository rules enforce them.

The repository is currently owned by one person. Requiring another approving reviewer would create a self-lockout because pull-request authors cannot approve their own changes. The policy therefore requires the pull-request workflow and CI evidence without requiring an unavailable second reviewer.

Repository settings are external control-plane state. Committing a policy document does not activate protection by itself, so the implementation separates reviewed desired state from live activation evidence.

## Decision

Commit `.github/policies/main-branch-protection.json` as the desired state for `main` and provide `scripts/configure-main-protection.mjs` to apply and verify that state through GitHub's branch protection REST API.

The active policy requires:

- all changes through pull requests;
- zero approving reviews while the repository remains solo-owned;
- strict, up-to-date required checks;
- `Lint`;
- `Type check`;
- `Migration drift`;
- `Unit, build, and rendered HTML`;
- conversation resolution before merge;
- enforcement for administrators with no bypass;
- no force pushes; and
- no branch deletion.

The policy does not require code-owner approval, last-push approval, signed commits, linear history, or a read-only branch at this phase.

## Activation

The connected GitHub integration used during ASTRO-115 could administer files, pull requests, and Actions evidence but did not expose branch-protection or ruleset mutation.

The repository owner therefore activated the reviewed policy manually through GitHub Settings on 2026-07-24. The owner confirmed rule creation after disabling the one-approval requirement and retaining the exact four CI checks and safety controls recorded in the committed policy.

The protected follow-up pull-request flow provides operational evidence that merging proceeds only after the required CI jobs succeed and does not require an unavailable external reviewer.

## Authentication boundary

Future API verification or repair requires a GitHub credential with repository Administration write permission. The credential must be short-lived, supplied through `GITHUB_ADMIN_TOKEN` or `GH_TOKEN`, and never committed, echoed, uploaded as an artifact, or pasted into chat.

## Verification

`npm run github:protect-main` performs a PUT followed by a GET and fails when live settings differ from policy. `npm run github:verify-main-protection` performs read-only verification.

`tests/branch-protection-policy.test.mjs` ensures the policy names the four real workflow jobs and retains the safety settings above.

Manual activation evidence and protected pull-request evidence are recorded in Jira under KAN-17 / ASTRO-115.

## Consequences

`main` now has an enforced pull-request and CI boundary. Direct unsafe updates, force pushes, branch deletion, unresolved conversations, stale branches, and failing required checks are blocked by the GitHub control plane.

The zero-review requirement is intentional for the current solo-owned repository and must be revisited when a second trusted reviewer is available. Staging deployment remains separate work under ASTRO-116.

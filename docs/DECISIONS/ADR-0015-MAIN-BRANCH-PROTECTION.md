# ADR-0015 — Main Branch Protection

- Status: Accepted policy; live activation pending administrator API access
- Date: 2026-07-24
- Jira: `KAN-17 / ASTRO-115`

## Context

ASTRO-111 through ASTRO-114 established four stable GitHub Actions checks and retained test evidence, but successful checks do not prevent an administrator or collaborator from pushing directly to `main` or merging a failing pull request unless GitHub repository rules enforce them.

The repository is currently owned by one person. Requiring another approving reviewer would create a self-lockout because pull-request authors cannot approve their own changes. The policy must therefore require the pull-request workflow and CI evidence without requiring an unavailable second reviewer.

Repository settings are external control-plane state. Committing a policy document does not activate protection by itself, so the implementation must separate reviewed desired state from live verification.

## Decision

Commit `.github/policies/main-branch-protection.json` as the desired state for `main` and provide `scripts/configure-main-protection.mjs` to apply and verify that state through GitHub's branch protection REST API.

The policy requires:

- all changes through pull requests;
- zero approving reviews while the repository remains solo-owned;
- strict, up-to-date required checks;
- `Lint`;
- `Type check`;
- `Migration drift`;
- `Unit, build, and rendered HTML`;
- conversation resolution before merge;
- enforcement for administrators;
- no force pushes; and
- no branch deletion.

The policy does not require code-owner approval, last-push approval, signed commits, linear history, or a read-only branch at this phase.

## Authentication boundary

Applying branch protection requires a GitHub credential with repository Administration write permission. The credential must be short-lived, supplied through `GITHUB_ADMIN_TOKEN` or `GH_TOKEN`, and never committed, echoed, uploaded as an artifact, or pasted into chat.

The connected GitHub integration used during ASTRO-115 can administer files, pull requests, and Actions evidence but does not expose branch-protection or ruleset mutation. Therefore, the committed script and policy can be verified in CI, but live activation remains pending until an administrator runs the apply command or configures the equivalent rule in GitHub Settings.

## Verification

`npm run github:protect-main` performs a PUT followed by a GET and fails when live settings differ from policy. `npm run github:verify-main-protection` performs read-only verification.

`tests/branch-protection-policy.test.mjs` ensures the policy names the four real workflow jobs and retains the safety settings above.

ASTRO-115 must not be marked complete solely because this ADR and policy are merged. Completion requires live verification evidence.

## Consequences

The repository gains a reviewable, repeatable branch-protection contract and avoids undocumented UI-only configuration. One privileged administrator action remains necessary because branch protection is GitHub control-plane state rather than repository content.

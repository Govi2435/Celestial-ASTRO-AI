# Celestial ASTRO AI — Main Branch Protection

- Status: Active
- Jira: `KAN-17 / ASTRO-115`
- Desired-state policy: `.github/policies/main-branch-protection.json`
- Apply and verify script: `scripts/configure-main-protection.mjs`
- Target: `Govi2435/Celestial-ASTRO-AI` branch `main`
- Activation method: GitHub repository Settings
- Activation date: 2026-07-24

## Active protection

Every change to `main` must arrive through a pull request and pass all four active CI jobs:

1. `Lint`
2. `Type check`
3. `Migration drift`
4. `Unit, build, and rendered HTML`

The required checks use strict mode, so the pull-request branch must be up to date with `main` before merging.

Additional controls:

- administrators are subject to the same protection and cannot bypass it;
- unresolved pull-request conversations block merging;
- force pushes are disabled;
- branch deletion is disabled;
- direct updates are blocked by the pull-request requirement;
- zero approving reviews are required because this is currently a solo personal repository;
- code-owner approval and last-push approval are disabled until a second trusted reviewer exists;
- the branch is not locked read-only; and
- linear history is not required because merge commits are currently allowed.

## Activation evidence

The repository owner activated the rule through GitHub Settings and confirmed creation after reviewing the following values:

- branch pattern `main`;
- pull-request requirement enabled;
- required approvals disabled;
- all four status checks selected;
- branches required to be up to date;
- conversation resolution enabled;
- bypass disabled for administrators;
- force pushes disabled; and
- deletions disabled.

The activation screenshots were provided during ASTRO-115 and the protected follow-up pull-request flow is used as operational evidence that the configured checks permit merging only after CI succeeds.

## Verify through the GitHub API

For future audits, use a short-lived fine-grained GitHub token with **Administration: write** permission for this repository. Do not paste the token into chat, commit it, or store it in a repository file.

Verify the active rule without changing it:

```text
GITHUB_ADMIN_TOKEN=<short-lived-token> npm run github:verify-main-protection
```

Reapply the committed policy and immediately read it back when an intentional settings repair is required:

```text
GITHUB_ADMIN_TOKEN=<short-lived-token> npm run github:protect-main
```

Delete or revoke the short-lived token after verification.

## Policy changes

Any intentional branch-protection change must update all of the following together:

- `.github/policies/main-branch-protection.json`;
- `tests/branch-protection-policy.test.mjs` when the contract changes;
- this operating document;
- ADR-0015 or a superseding ADR; and
- Jira evidence explaining the reason and approval.

The exact required check names must continue to match the GitHub Actions job names.

## Recovery

If the branch becomes unexpectedly blocked:

1. inspect which required check is missing, failing, or stale;
2. confirm the check name still matches the workflow job name exactly;
3. update the pull-request branch with `main` when strict mode requires it;
4. resolve outstanding pull-request conversations;
5. inspect the validated test artifact when the test job fails;
6. temporarily edit the GitHub rule only when a documented incident requires it; and
7. restore and verify the committed policy immediately after recovery.

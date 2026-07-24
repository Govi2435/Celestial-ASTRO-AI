# Celestial ASTRO AI — Main Branch Protection

- Jira: `KAN-17 / ASTRO-115`
- Desired-state policy: `.github/policies/main-branch-protection.json`
- Apply and verify script: `scripts/configure-main-protection.mjs`
- Target: `Govi2435/Celestial-ASTRO-AI` branch `main`

## Desired protection

The reviewed policy requires every change to `main` to arrive through a pull request and pass all four active CI jobs:

1. `Lint`
2. `Type check`
3. `Migration drift`
4. `Unit, build, and rendered HTML`

The required checks use strict mode, so the pull-request branch must be up to date with `main` before merging.

Additional controls:

- administrators are subject to the same protection;
- unresolved pull-request conversations block merging;
- force pushes are disabled;
- branch deletion is disabled;
- direct updates are blocked by the pull-request requirement;
- zero approving reviews are required because this is currently a solo personal repository;
- code-owner approval and last-push approval are disabled until a second trusted reviewer exists;
- the branch is not locked read-only; and
- linear history is not required because merge commits are currently allowed.

## Apply through the GitHub API

Use a short-lived fine-grained GitHub token with **Administration: write** permission for this repository. Do not paste the token into chat, commit it, or store it in a repository file.

```text
GITHUB_ADMIN_TOKEN=<short-lived-token> npm run github:protect-main
```

The command sends the reviewed policy to GitHub and immediately reads the resulting branch protection back. It fails unless every configured field matches.

Verify an existing rule without changing it:

```text
GITHUB_ADMIN_TOKEN=<short-lived-token> npm run github:verify-main-protection
```

Delete or revoke the short-lived token after successful verification.

## Apply through GitHub Settings

When using the web interface, open the repository settings and create a branch protection rule or active ruleset targeting `main` with the values recorded in `.github/policies/main-branch-protection.json`.

The exact required check names must match the four CI job names above. A required check must have run recently in the repository before GitHub allows it to be selected.

## Verification evidence

ASTRO-115 is complete only when the live GitHub rule has been read back and matches the committed policy. Repository files alone are not proof that branch protection is active.

Record the following evidence in Jira:

- activation method;
- activation timestamp;
- policy commit;
- verification command or Settings screenshot;
- required check names;
- strict/up-to-date setting;
- pull-request requirement;
- admin enforcement;
- conversation-resolution requirement;
- force-push and deletion state.

## Recovery

If the branch becomes unexpectedly blocked:

1. inspect which required check is missing or stale;
2. confirm the check name still matches the workflow job name exactly;
3. update the pull-request branch with `main` when strict mode requires it;
4. review unresolved conversations;
5. temporarily edit the GitHub rule only when a documented incident requires it; and
6. restore and verify the committed policy immediately after recovery.

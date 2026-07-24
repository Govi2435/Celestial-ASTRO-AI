# Celestial ASTRO AI — Continuous Integration

- Status: Active baseline
- Jira: `KAN-17 / ASTRO-111`
- Workflow: `.github/workflows/ci.yml`

## Current automated check

The `CI` workflow runs on pull requests, pushes to `main`, and manual dispatch.

It uses a clean GitHub-hosted Ubuntu runner, Node.js `22.19.0`, the committed `package-lock.json`, and the repository's verified test command:

```text
npm ci --no-audit --no-fund
npm test
```

`npm test` currently executes:

1. all registered unit and domain tests;
2. the production application build; and
3. the rendered HTML test.

The workflow has read-only repository permissions, does not persist checkout credentials, does not use production secrets, cancels superseded runs, and has a bounded timeout.

## Current limitations

This baseline does not yet make CI a mandatory merge gate. The following remain pending:

- dedicated lint and type-check jobs;
- migration drift validation;
- uploaded test artifacts;
- branch protection and required status checks;
- staging deployment and promotion;
- security and dependency scanning.

These controls are tracked under ASTRO-112 through ASTRO-116 and must not be described as active before their evidence exists.

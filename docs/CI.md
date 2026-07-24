# Celestial ASTRO AI — Continuous Integration

- Status: Active baseline
- Jira: `KAN-17 / ASTRO-111–ASTRO-112`
- Workflow: `.github/workflows/ci.yml`

## Current automated checks

The `CI` workflow runs on pull requests, pushes to `main`, and manual dispatch.

It now exposes three independent jobs on clean GitHub-hosted Ubuntu runners with Node.js `22.19.0` and dependencies installed from the committed `package-lock.json`:

| Check | Command | Purpose |
| --- | --- | --- |
| `Lint` | `npm run lint` | Enforce the current ESLint and Next.js rules |
| `Type check` | `npm run typecheck` | Run strict TypeScript validation with no output |
| `Unit, build, and rendered HTML` | `npm test` | Run unit/domain tests, production build, and rendered HTML verification |

The workflow has read-only repository permissions, does not persist checkout credentials, does not use production secrets, cancels superseded runs, and uses bounded job timeouts.

## Type-check contract

`npm run typecheck` executes the repository compiler configuration through:

```text
tsc --noEmit --pretty false
```

The existing `tsconfig.json` remains authoritative and already enables strict mode and no-emission behavior.

## Current limitations

CI checks are active, but they are not yet mandatory merge gates. The following remain pending:

- migration drift validation;
- uploaded test artifacts;
- branch protection and required status checks;
- staging deployment and promotion;
- security and dependency scanning.

These controls are tracked under ASTRO-113 through ASTRO-116 and must not be described as active before their evidence exists.

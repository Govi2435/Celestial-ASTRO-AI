# Celestial ASTRO AI — Continuous Integration

- Status: Active baseline
- Jira: `KAN-17 / ASTRO-111–ASTRO-113`
- Workflow: `.github/workflows/ci.yml`

## Current automated checks

The `CI` workflow runs on pull requests, pushes to `main`, and manual dispatch.

It exposes four independent jobs on clean GitHub-hosted Ubuntu runners with Node.js `22.19.0` and dependencies installed from the committed `package-lock.json`:

| Check | Command | Purpose |
| --- | --- | --- |
| `Lint` | `npm run lint` | Enforce the current ESLint and Next.js rules |
| `Type check` | `npm run typecheck` | Run strict TypeScript validation with no output |
| `Migration drift` | `npm run db:validate` | Replay committed migrations and compare their canonical schema with the reviewed baseline |
| `Unit, build, and rendered HTML` | `npm test` | Run unit/domain tests, production build, and rendered HTML verification |

The workflow has read-only repository permissions, does not persist checkout credentials, does not use production secrets, cancels superseded runs, and uses bounded job timeouts.

## Type-check contract

`npm run typecheck` executes the repository compiler configuration through:

```text
tsc --noEmit --pretty false
```

The existing `tsconfig.json` remains authoritative and already enables strict mode and no-emission behavior.

## Migration-drift contract

`npm run db:validate`:

1. requires migration filenames to be sequential from `0000`;
2. records normalized SHA-256 values for every committed SQL migration;
3. replays every migration in order against an in-memory SQLite database;
4. runs `PRAGMA foreign_key_check`;
5. fingerprints tables, columns, indexes, and foreign keys;
6. compares the final schema with `drizzle/migration-manifest.json`; and
7. verifies that every typed Drizzle table exists in the migrated database.

The current reviewed baseline contains 11 migrated tables and 3 typed Drizzle tables. This is deliberately recorded as **partial parity**. ASTRO-113 prevents silent drift; it does not claim that the P7/P8 schema-parity work assigned to P9-D is complete.

For an intentional reviewed migration change, regenerate the baseline with:

```text
npm run db:baseline
```

The SQL migration and manifest changes must be reviewed together. CI never runs the baseline-writing command.

## Current limitations

CI checks are active, but they are not yet mandatory merge gates. The following remain pending:

- uploaded test artifacts;
- branch protection and required status checks;
- staging deployment and promotion;
- security and dependency scanning;
- full P7/P8 typed-schema parity and production migration execution.

These controls remain tracked under ASTRO-114 through ASTRO-116 and P9-D. They must not be described as active before their evidence exists.

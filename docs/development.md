# Development

The root pnpm scripts are the source of truth for repository tasks.

## Validation

Choose verification by the affected boundary:

- `pnpm validate` runs lint, type checks, service/component tests, and the build.
- `pnpm test:electron browser plugins` checks web and local native widget surfaces.
- `pnpm test:electron workspace` checks dashboard/workspace transitions.
- `pnpm test:electron storage resources` checks scoped persistence and sharing.
- `pnpm test:electron` runs all five native scenarios for cross-cutting changes
  and release checks. Each selected scenario runs once, with its own temporary
  profile and bounded application cleanup; an unknown scenario fails explicitly.

A cosmetic change normally needs the relevant component checks and visual QA,
plus a native scenario only when native views or input are affected. Detailed
validation rules belong in service tests; native tests exercise real preload,
IPC, process isolation, and persistence wiring. See
[Electron test responsibilities](../apps/desktop/test/e2e/README.md) before
adding another end-to-end assertion.

`pnpm lint:fix` applies ESLint fixes to root scripts, tooling tests, and every
workspace before checking repository and workflow boundaries. JavaScript uses
ESLint recommended correctness checks with explicit Node/browser globals;
TypeScript retains type-aware checks for source and tests. React source also
checks Hook call order and effect dependencies. Editor indentation matches
ESLint: four spaces for JavaScript/TypeScript and two for JSON/YAML.

`pnpm lint` also validates repository boundaries, including catalog and
workspace dependency declarations, renderer privilege isolation, and the
runtime neutrality of public plugin and ACP contracts.

`pnpm test` runs Node.js unit and integration tests and headless Chromium browser tests.
Tests live under each workspace's `test/unit/` or `test/integration/`, mirroring
the source subtree. Desktop Vitest projects separate `unit`, `integration`, and
`browser` execution; `test/e2e/` is run separately by `pnpm test:electron`.
Browser tests use the `*.browser.test.ts` suffix and cover renderer plugin DOM
behavior; they do not replace Electron main/preload integration testing.
Before the first browser test run, install Chromium with:

```sh
pnpm --filter @avesd/desktop exec playwright install chromium
```

## Dependency maintenance

External dependency versions belong in the root catalog; internal dependencies
use `workspace:*`. Maintenance commands preserve the workspace release-age
policy. `update-self` selects a stable pnpm version old enough to satisfy
`minimumReleaseAge`, rather than immediately installing the latest release.

- `pnpm depcheck` reports outdated packages and GitHub Actions.
- `pnpm ud` updates within declared ranges and deduplicates the lockfile.
- `pnpm iud` installs, runs `ud`, and updates the pinned pnpm version.
- `pnpm update-dependencies` updates package dependencies, including major versions.
- `pnpm update-actions` updates referenced GitHub Actions separately.
- `pnpm update-all` updates packages and Actions, then deduplicates the lockfile.
- `pnpm update-self` updates pnpm; `pnpm self-update` remains an alias.
- `pnpm sort-dependencies`, `pnpm sort-workspace`, and `pnpm sort-all` sort
  dependency declarations and workspace catalog entries without changing versions.

All maintenance commands above except `depcheck` support `--dry-run`. Previews
make no repository writes or installations. Update previews may query the
registry; they report candidates, not a resolved replacement lockfile. The
`ud`/`iud` previews describe the planned command sequence. Unknown options fail
before execution, and command failures stop the remaining steps.

```sh
pnpm update-all --dry-run
pnpm update-self --dry-run
pnpm sort-all --dry-run
make update-all ARGS=--dry-run
```

Run `pnpm validate` after applying updates. Root tooling tests cover maintenance
previews, failure propagation, sorting, and workflow policy; they run as part of
`pnpm test`. Equivalent Make targets remain thin wrappers around pnpm scripts;
running plain `make` (or `make help`) displays the available targets. The root
Makefile includes `make/development.mk`, `make/checks.mk`,
`make/maintenance.mk`, and `make/help.mk`. Use `make install` for a frozen
lockfile installation, and `make test-electron ARGS="storage resources"` to
select native scenarios. `make default` remains an alias for help.

## Continuous integration

GitHub Actions runs on pushes, pull requests, and manual dispatch. Linux and
macOS validation jobs install with `--frozen-lockfile`, install Chromium and its
system dependencies, and run `pnpm validate`.

The separate `pnpm test:electron` suite is not an automatic CI gate yet: its
shared launch helper still waits for the former `.dashboard-grid`, and widget
scenarios assume the legacy dashboard UI. Migrate those assertions to the
current Canvas product contract before enabling the suite in CI. Do not bypass
its assertions or restore the old UI solely to make validation pass.

Both jobs use the Node version in `.nvmrc`, the pnpm version in `package.json`,
read-only permissions, SHA-pinned Actions, and checkout without persisted
credentials. `pnpm check:workflows` enforces these workflow conventions as part
of lint. Dependabot proposes weekly Actions updates. CI needs no cloud account
or application credentials; local development remains independent of CI.

# Development

The root pnpm scripts are the source of truth for repository tasks.

## Validation

`pnpm validate` runs lint, type checks, and the production build across all
workspaces, including `packages-ui/*`. Run `pnpm --filter @avesd/ui-grid test`
for responsive geometry and row planning. The desktop has its own `test` and
`test:run` commands; select checks according to the repository verification policy.

Use Playwright against the real Electron application for routine UI regression:

```sh
pnpm --filter @avesd/desktop test:e2e
# Select one scenario; this command also rebuilds the desktop first.
pnpm --filter @avesd/desktop test:e2e --grep "controller expands"
```

The command builds the desktop and runs `test/e2e/*.spec.ts` serially. It uses the
workspace Electron binary; no Playwright browser download is required. A graphical
session is required (use Xvfb on Linux CI). These native tests are separate from
`pnpm validate` and the desktop unit/integration suite; CI does not run them yet.
Playwright's Electron support is experimental, so rerun these smoke tests after
Electron or Playwright upgrades.

Each test starts a fresh app through a test-only bootstrap that redirects home,
user data, session data, logs, and environment files into a temporary directory.
Only launch-related environment variables are inherited, not provider credentials
or development renderer URLs. The fixture closes the app and removes its data on
teardown. Production renderer, preload, IPC, and persistence remain in use.
Use synthetic data and role/name locators; use pointer coordinates for canvas
surfaces only when semantic locators are unavailable. Keep tests in `test/e2e/`,
which is covered by desktop lint and type checks.

Behavior assertions are the default for existing interactions. For rendered changes,
use focused screenshots and pixel inspection; stable visual cases may use reviewed
screenshot baselines. Store ad hoc screenshots in an OS temporary directory. A
passing interaction assertion alone does not prove visual correctness. Reserve
Computer Use or manual checks for exploratory review and OS-level interactions
that Playwright cannot cover, such as native file dialogs or window-manager drag.
Safe substitutes for preload services can verify renderer presentation, but do not
establish native or provider connectivity.
See the [UI contract](../packages-ui/README.md) for style and ownership rules.

`pnpm lint:fix` repairs file headers and applies ESLint fixes to root scripts and every workspace before
checking repository and workflow boundaries. JavaScript uses ESLint recommended
correctness checks with explicit Node/browser globals; TypeScript retains
type-aware source checks. React source also checks Hook call order and effect
dependencies. Editor indentation matches ESLint: four spaces for
JavaScript/TypeScript and two for JSON/YAML.

`pnpm lint` also validates repository boundaries, including catalog and
workspace dependency declarations, renderer privilege isolation, and the
runtime neutrality of public plugin contracts.

## File headers

Every maintained JavaScript and TypeScript source, test, and configuration file
starts with this header, followed by one blank line:

```ts
/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas
 * @description Canvas service operations
 */
```

The checker covers root configuration files, `scripts/`, `.github/`, and packages
declared by the immediate workspace patterns in `pnpm-workspace.yaml`, including
`apps/*`, `packages/*`, `packages-renderer/*`, and `packages-ui/*`. Supported
extensions are `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs`, and `.cjs`.
It excludes `.d.ts`, `.d.mts`, and `.d.cts` declarations, symbolic links,
dependencies, build and coverage output, tool caches, and temporary `working/`
material. `scripts/release/` contains maintained scripts and remains included;
workspace `release/` output is excluded. HTML, CSS, JSON, YAML, and Markdown files
do not require JavaScript headers.

Use `pnpm check:file-headers` to report missing or malformed headers without
writing files. Use `pnpm fix:file-headers` to repair them. Equivalent Make targets
are `make check-file-headers` and `make fix-file-headers`. `pnpm lint` includes
the check, so `pnpm validate` and CI enforce it; `pnpm lint:fix` runs the repair.
Run the tool's behavior tests with `pnpm test:file-headers`.

The repair uses `@author Avesd` and retains existing nonempty package, namespace,
and description values, along with extra annotations such as `@license`. For
missing fields, it derives the package label from the workspace manifest name
(or `Workspace`, `Scripts`, or `GitHub`), the namespace from directories joined
with underscores (omitting a workspace's leading `src/`, using `Root` at its
top level), and the description from the filename. Keep descriptions meaningful
when editing them. The tool preserves shebangs, byte order marks, line endings,
leading documentation comments, and executable content. Repeating a repair makes
no further changes.

## Dependency maintenance

External dependency versions belong in the root catalog; internal dependencies
use `workspace:*`. Maintenance commands preserve the workspace release-age
policy. `update-self` selects a stable pnpm version old enough to satisfy
`minimumReleaseAge`, rather than immediately installing the latest release.
TypeScript stays at `6.0.3` and is excluded from automated dependency upgrades
through `updateConfig.ignoreDependencies`: ESLint and repository validators need
the TypeScript 6 programmatic API. Revisit this exclusion when the adopted tools
support TypeScript 7.

- `pnpm depcheck` reports outdated packages and GitHub Actions.
- `pnpm ud` updates within declared ranges and deduplicates the lockfile.
- `pnpm iud` installs, runs `ud`, and updates the pinned pnpm version.
- `pnpm update-dependencies` updates package dependencies, including major versions.
- `pnpm update-actions` updates referenced GitHub Actions separately.
- `pnpm update-all` updates packages and Actions, then deduplicates the lockfile.
- `pnpm update-self` updates pnpm; `pnpm self-update` remains an alias.
- `pnpm sort-dependencies` sorts dependency declarations only in package manifests.
- `pnpm sort-all` sorts both package manifests and the workspace configuration,
  without changing dependency versions.
- `pnpm sort-workspace` sorts only `pnpm-workspace.yaml`. Dependency keys beginning
  with `@` use double quotes; other dependency keys use plain YAML syntax. Comments
  and version values are preserved.

Manifest sorting discovers immediate workspace groups from `pnpm-workspace.yaml`,
including renderer and UI packages. It skips symlinked workspaces and directories
without a package manifest. Run `pnpm test:dependency-sorting` for its fixture tests.

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

Run `pnpm validate` after applying updates. Equivalent Make targets remain
thin wrappers around pnpm scripts; running plain `make` (or `make help`)
displays the available targets. The root Makefile includes
`make/development.mk`, `make/checks.mk`, `make/maintenance.mk`,
`make/release.mk`, and `make/help.mk`. Use `make install` for a frozen lockfile
installation. `make default` remains an alias for help.

## Continuous integration

GitHub Actions runs on pushes, pull requests, and manual dispatch. Linux and
macOS validation jobs install with `--frozen-lockfile` and run `pnpm validate`.

Both jobs use the Node version in `.nvmrc`, the pnpm version in `package.json`,
read-only permissions, SHA-pinned Actions, and checkout without persisted
credentials. `pnpm check:workflows` enforces these workflow conventions as part
of lint. Dependabot proposes weekly Actions updates. CI needs no cloud account
or application credentials; local development remains independent of CI.

## Release preparation

The desktop release version starts at `0.1.0` in `apps/desktop/version.json`.
Use `make changeset` to record a change, `make version-dry-run` to preview pending
versions, and `make version-packages` to prepare manifests, changelogs, and history.
These commands do not publish or operate on Git. See
[Release versioning](release-versioning.md) for interactive and noninteractive
usage, target selection, version skip rules, and consumption history.

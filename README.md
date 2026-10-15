# Avesd Core Monorepo

Avesd is a local-first spatial desktop workspace. Its primary surface is an
dashboard: an infinite canvas of ideas, URL sources, cited conclusions, groups,
and links. Each dashboard opens in its own window without a permanent toolbar.
Agents create and change dashboard content. People drag empty space to pan,
scroll to zoom, and select objects to inspect them. A minimal, always-on-top controller
lets people converse with an Agent that discovers and operates dashboards through
explicit resource tools. Dashboard windows provide browsing and selection without manual content editing. Voice input is planned for a later stage. The Electron application keeps
local canvas use independent of an account or cloud service.

The earlier dashboard, widget, and plugin infrastructure remains in the
repository while existing workspace data and services are migrated. The canvas
is the current primary view; old widget data is retained in workspace snapshots
but is not shown there yet. See [Canvas architecture](docs/canvas.md) and
[Canvas service](docs/canvas-service.md).

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- Corepack
- pnpm 11.23.0 (pinned in `package.json`)

## Getting started

```sh
pnpm install
pnpm dev
```

Use the root pnpm scripts for repository tasks:

```sh
pnpm lint
pnpm lint:fix
pnpm compile
pnpm build
pnpm validate
```

Equivalent Make targets provide short, stable entry points such as `make dev`,
`make validate`, and `make update-all`; running plain `make` displays help.
Targets are grouped under `make/`, with the root Makefile including each group.
See [Development](docs/development.md) for test selection, validation boundaries,
browser test setup, and dependency maintenance.

## Repository layout

- `assets/brand` — source SVGs and usage notes for the Avesd bird mark.
- `apps/desktop` — Electron main, preload, and React renderer processes.
- `packages/acp-client` — provider-neutral ACP v1 client boundary.
- `packages/configuration` — shared TypeScript and ESLint defaults.
- `packages/kernel` — legacy Cordis-backed plugin lifecycle adapter and
  contribution registries.
- `packages/plugin-api` — stable contracts implemented by plugins.
- `packages/plugin-data` — runtime-neutral local data-source contributions.
- `packages/plugin-ui` — framework-neutral renderer widget contracts and
  contribution points.
- `packages/ui` — internal React components and design tokens for trusted Avesd
  product surfaces.
- `packages/workspace-model` — runtime-neutral canvas commands and legacy
  workspace, dashboard, widget, and data-source ownership contracts.
- `.agents/common-skills-policy.md` and `.agents/audit-policy.md` — local
  repository policy for globally installed shared skills.
- `working` — non-authoritative audits, plans, notes, and archived project
  memory.

Desktop code preserves process boundaries and groups related files by feature:

```text
apps/desktop/
  src/
    main/
      main.ts               # Process startup entry
      desktop-application.ts # Application composition, IPC, and lifecycle
      agent/                # Agent transport, tools, permissions, MCP entry
      browser/              # Native web surfaces and browser bindings
      plugins/              # Local authoring, installation, sandboxed views
      storage/              # Config, workspace files, scoped storage, resources
      workspace/            # Workbench orchestration and widget service bridge
    preload/
      preload.ts            # Context bridge startup entry
      desktop-api.ts        # Narrow privileged bridge implementation
    shared/
      browser/              # Browser IPC contracts
      plugins/              # Local plugin IPC contracts
      storage/              # File, SQLite, and resource contracts/facades
      workspace/            # Widget workspace contracts/facades
      desktop-api.ts        # Aggregate preload API
      widget-appearance.ts  # DOM/native geometry
    renderer/src/
      components/           # Dashboard shell and widget hosting
      workbench/            # Renderer orchestration
      plugins/              # One directory per built-in plugin/adapter
```

The previous automated test suites and synthetic scenarios have been removed.
`pnpm validate` currently runs lint, type checks, and the production build.
The first real usage scenario has not been defined yet. Future tests belong in
each workspace's `test/` directory and must be included in compile and lint checks.
Add a feature folder when several related files need a home; avoid generic
`utils` folders, internal barrel files, or new packages solely to shorten paths.

Package-level `src/index.ts` files define the public export surface and contain
only re-exports. Put declarations, factories, and behavior in files named for
their responsibilities. Configuration factories use explicit filenames; package export specifiers remain
stable. Executable
entry points use names such as `main.ts` and `preload.ts` and keep startup wiring
small. Build outputs remain `out/main/index.js` and `out/preload/index.cjs`.

Shared ESLint rules apply to workspace source, configuration, and root
scripts. `pnpm lint` checks `scripts/` and the root ESLint configuration before
running workspace checks. Nonempty function and enum bodies start with one blank
line after `{`; a `return` preceded by another statement in its block also has a
blank line before it. Empty bodies do not need padding. These conventions are
autofixable, including the requirement to use braces around conditional bodies.

## Architecture overview

Avesd keeps a small trusted Electron host. Renderer code reaches privileged
behavior only through narrow typed preload APIs and explicit IPC contracts.
Canvas edits from the UI and Agent use the same validated, serialized main-process
operation path. Canvas objects live in the active dashboard's versioned view
state, while old widget state remains available for future migration.

Workspaces still own dashboards and shared data sources during this transition.
The canvas is currently scoped to a dashboard. Agent tools can inspect, add,
move, update, group, link, remove, and undo canvas content. The renderer never
writes a workspace snapshot directly.

The local workflow requires no account or cloud service. Workspace snapshots,
plugin data, browser grants, and application settings remain on the user's
machine. Sandboxed local widgets and embedded web pages receive only explicitly
declared, host-mediated capabilities.

See [Canvas architecture](docs/canvas.md) for the current interaction model and
[Runtime architecture](docs/runtime-architecture.md) for the retained dashboard
and plugin infrastructure.

## Documentation

- [Release versioning](docs/release-versioning.md) — changesets, version previews, and release history.
- [Development](docs/development.md) — validation, tests, and dependency tasks.
- [Canvas architecture](docs/canvas.md) — canvas data, interaction, and Agent tools.
- [Runtime architecture](docs/runtime-architecture.md) — process boundaries,
  workspace ownership, navigation, persistence, and Agent integration.
- [Application configuration](docs/application-configuration.md) — local data
  directory configuration and migration.
- [Local widgets](docs/local-widgets.md) — Agent-authored widgets, private
  storage, shared resources, testing, and activation.
- [Agent sessions](docs/agent-sessions.md) — tier routing, widget tasks, and unified session management.
- [Browser widgets](docs/browser-widgets.md) — embedded pages, script tools, and
  browser control bindings.

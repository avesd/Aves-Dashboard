# Avesd Core Monorepo

Avesd is a local-first spatial desktop workspace. Its primary surface is an
independent canvas window, with a separate always-on-top controller for Agent
conversations, canvas discovery, and shared settings. Its core local workflow
requires no account, network connection, or cloud service.

Agents create independent HTML/CSS/SVG blocks with optional presentation
JavaScript. Each block can receive live data and invoke registered host actions.
The canvas manages placement while a sandboxed document renders each block.
Source, data, and saved interaction state persist locally. See
[Dashboard blocks](docs/dashboard-blocks.md) for the five Agent tools and runtime
bridge. The earlier fixed card/source/conclusion/group model has been removed.

The earlier dashboard, widget, and plugin infrastructure remains for
compatibility. Existing opaque view-state and legacy widget data stay in local
storage but are not rendered in the canvas. See [Canvas architecture](docs/canvas.md)
and [Canvas service](docs/canvas-service.md).

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
- `packages/acp-management` — extensible provider registry, local installation
  discovery, launch strategies, and model/effort capability management.
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
Canvas resource operations from the UI and Agent use the same validated,
serialized main-process path. Legacy view-state and widgets remain opaque
stored data while component rendering is redesigned.

Workspaces still own dashboards and shared data sources during this transition.
Canvas IDs reuse dashboard IDs. Interactive Agents receive five
`aves_dashboard_` MCP tools for canvas discovery, opening windows, discovering
capabilities, submitting blocks, and inspecting live output. Source/layout
changes use canvas revisions and atomic receipts; live data and saved view state
have independent revisions. The renderer never writes workspace files directly.

The local workflow requires no account or cloud service. Workspace snapshots,
plugin data, browser grants, and application settings remain on the user's
machine. Sandboxed local widgets and embedded web pages receive only explicitly
declared, host-mediated capabilities.

See [Canvas architecture](docs/canvas.md) for the current interaction model and
[Runtime architecture](docs/runtime-architecture.md) for the retained dashboard
and plugin infrastructure.

## Documentation

- [Design language](docs/design-language.md) — approved visual direction: content
  in space, light-field atmosphere, and precise presentation; initial dashboard adoption.
- [Release versioning](docs/release-versioning.md) — changesets, version previews, and release history.
- [Development](docs/development.md) — validation, tests, and dependency tasks.
- [Dashboard blocks](docs/dashboard-blocks.md) — source rendering, live data, host actions, and the five tools.
- [Canvas architecture](docs/canvas.md) — canvas data, interaction, and Agent tools.
- [Runtime architecture](docs/runtime-architecture.md) — process boundaries,
  workspace ownership, navigation, persistence, and Agent integration.
- [Application configuration](docs/application-configuration.md) — local data
  directory configuration and migration.
- [Local widgets](docs/local-widgets.md) — compatibility widgets, private
  storage, shared resources, testing, and activation.
- [Agent sessions](docs/agent-sessions.md) — tier routing, widget tasks, and unified session management.
- [Browser widgets](docs/browser-widgets.md) — embedded pages, script tools, and
  browser control bindings.

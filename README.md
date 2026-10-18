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
pnpm check:file-headers
pnpm fix:file-headers
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
- `apps/desktop` — Electron main, preload, and canvas renderer processes.
- `packages-renderer/canvas` — canvas renderer, sandbox block presentation and viewport interactions.
- `packages-renderer/controller` — floating controller renderer, voice controls and session UI.
- `packages/desktop-contracts` — runtime-neutral contracts shared by the desktop and renderer packages.
- `packages-renderer/settings` — independent settings window renderer and its narrow API contracts.
- `packages/configuration` — shared TypeScript and ESLint defaults.
- `packages/kernel` — legacy Cordis-backed plugin lifecycle adapter and
  contribution registries.
- `packages/plugin-api` — stable contracts implemented by plugins.
- `packages/plugin-data` — runtime-neutral local data-source contributions.
- `packages/plugin-ui` — framework-neutral renderer widget contracts and
  contribution points.
- `packages-ui/*` — Theme, Controls, Grid, Data, Layout, class utilities, and the
  Avesd mark. See the [shared UI contract](packages-ui/README.md).
- `packages-renderer/agent` — shared domain-aware model-option loading.
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
      desktop-application.ts # Service composition and application lifecycle
      ipc/                  # Capability-specific IPC registration and authorization
      agent/                # Agent transport, tools, permissions, MCP entry
      browser/              # Native web surfaces and browser bindings
      plugins/              # Local authoring, installation, sandboxed views
      storage/              # Config, workspace files, scoped storage, resources
      workspace/            # Workbench orchestration and widget service bridge
    preload/
      preload.ts            # Context bridge startup entry
      controller-api.ts     # Controller capability composition
      canvas-view-api.ts    # Canvas capability composition
      settings.ts           # Dedicated settings bridge
      preload-ipc.ts        # Host-only IPC transport type
    shared/
      browser/              # Browser IPC contracts
      plugins/              # Local plugin IPC contracts
      storage/              # File, SQLite, and resource contracts/facades
      workspace/            # Widget workspace contracts/facades
      desktop-api.ts        # Compatibility Agent/workspace channels and context
      widget-appearance.ts  # DOM/native geometry
    renderer/
      canvas.html           # Canvas HTML shell and CSP
      controller.html       # Controller HTML shell and CSP
      settings.html         # Settings HTML shell and CSP
      public/               # Shared static assets
      src/                  # Thin package entry assembly and Vite types
```

`pnpm validate` runs lint, type checks, and the production build; it does not
run runtime tests. Choose checks by change scope using `AGENTS.md` rather than
running every check after each edit.

Desktop tests live in `apps/desktop/test/` and are included in compile and lint.
Run an affected test file, or several files, from the repository root:

```sh
pnpm --filter @avesd/desktop test:run test/integration/desktop-ipc.test.ts test/unit/main/ipc/ipc-result.test.ts
```

Use `pnpm --filter @avesd/desktop test` for the complete desktop suite when the
change warrants it. Keep authorization, cancellation, persistence, and protocol
boundary coverage; consolidate overlapping schema checks into boundary tests.

Feature ownership is also reflected inside the larger workspaces:

- `packages/workspace-model/src/workspace/` owns workspace types, catalog queries,
  navigation, and domain errors; `canvas/` owns canvas metadata and block schemas.
- `packages/workspace-model/src/repository/` owns snapshot validation and repository
  implementations; `widgets/` and `resources/` retain widget/data-source and scoped
  resource contracts.
- `apps/desktop/src/main/agent/sessions/` owns session coordination, connection
  lifetimes, execution/cancellation, question continuations, and event storage.
  Entries remain owned by the session coordinator; extracted workflows share those
  entries rather than maintaining parallel lifecycle state.
- `apps/desktop/src/main/canvas/blocks/` owns block runtime coordination, sandbox
  protocol registration, leases, action transactions, snapshots, and inspection.
- `packages-renderer/controller/src/` groups chat, sessions, canvas discovery,
  runtime selection, and voice by feature. `components/Controller.tsx` composes them.
- `packages-renderer/canvas/src/blocks/` separates React rendering from sandbox
  synchronization and validated message forwarding.
- `packages-renderer/controller/src/chat/` owns transcript presentation and event reduction.
- `packages-renderer/agent/` owns model-option loading shared with Settings.
- `packages-ui/*` separates visual foundations from reusable compositions.

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


### Agent API configuration

The desktop Agent calls DeepSeek directly; GPT-Live remains the optional voice
front end. Open **Settings → Models & services** to save a DeepSeek key and an
optional OpenAI key. Keys are encrypted with the operating system's secure
storage and apply to new requests without restarting. Settings support replacement,
deletion, and explicit authentication checks. API keys are not read from environment
variables or `.env` files. See [Agent sessions](docs/agent-sessions.md) for storage,
connection-test limits, cancellation, tool authorization, and validation details.

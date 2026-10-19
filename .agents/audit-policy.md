# Repository Audit Policy

## Repository profile

- Repository purpose: A local-first spatial desktop workspace where people and Agents change persistent canvases through explicit operations, with optional cloud capabilities deferred (`AGENTS.md`, `README.md`).
- Artifact language: English.
- User communication language: Chinese by default, as required by `AGENTS.md`.
- Applicable instructions: Root `AGENTS.md` plus every nearer subtree `AGENTS.md` governing touched paths.

## Authority and decisions

- Current-contract sources: Root `AGENTS.md` owns cross-cutting boundaries; `README.md` owns product orientation and onboarding. Use `docs/canvas.md`, `docs/canvas-service.md`, and `docs/dashboard-blocks.md` for canvas behavior; `docs/design-language.md` and `packages-ui/README.md` for presentation; `docs/agent-sessions.md` for Agent execution and credentials; `docs/application-configuration.md` for configuration; `docs/development.md` and `docs/release-versioning.md` for tooling. Compatibility behavior is documented in `docs/runtime-architecture.md`, `docs/local-widgets.md`, and `docs/browser-widgets.md`. Owning exported contracts, implementation, and tests supply executable details. Terminology routing is in `.agents/common-skills-policy.md`; working plans and reports are non-authoritative (`working/README.md`).
- Decision records: Not configured.
- Classification guide: Built into common audit skills.
- Conflict handling: Applicable instructions govern. Confirm observed behavior against current implementation and tests, then compare it with the matching current-contract source. Record unresolved conflicts among sources as decision notes unless a defect independently violates an unambiguous requirement; never silently choose new semantics or let a plan/report override a current contract.

## Audit storage

- Scope log: `working/audits/log.md`.
- Scope-log entry format: Append `- YYYY-MM-DD HH:MM:SS ZZZ - Audited: SCOPE` in English after scope confirmation, replacing `SCOPE` with the actual audit scope; exclude findings, secrets, selection mechanics, and speculative notes.
- Scope-log retention: 16 newest timestamped audit entries, preserving the heading, prose, and chronological order.
- Reports directory: `working/audits/reports/`.
- Report filename convention: `YYYY-MM-DD_HH-MM-SS.md` using local repository time.
- Report template override: Use the common `audit-repository` skill template.

## Audit workflow

- Direction selection: Ask the user to select one or more repository-specific directions unless the user already names the scope or explicitly authorizes autonomous selection.
- Production edits during audit: Prohibited. Audit and remediation are separate phases.
- Report threshold: Create a report only when at least one independently verified remediation-ready defect survives. Always update the scope log after scope confirmation.
- Concurrency and concurrent-work handling: Re-open accepted evidence before publication, avoid modifying files during audit, and defer findings whose evidence is changing concurrently.
- Git inspection: Inspect Git context only when the user separately authorizes Git work for the turn.
- Empty-report history fallback: Disabled.

## Repository-specific review lenses

- Protected invariants: Core local workflows need no account, network, or cloud service. New canvas capabilities must not depend on the retained dashboard/plugin runtime. Renderer code has no direct Node.js, privileged Electron, filesystem, credential, or persistence access; typed preload APIs and explicit IPC contracts mediate privileges. Domain rules remain independent of Electron, React, persistence drivers, and cloud implementations. Sensitive user data and credentials must not enter logs, fixtures, snapshots, or committed environment files (`AGENTS.md`).
- Priority surfaces: Electron main/preload/renderer isolation and IPC validation; canvas client identity, explicit targeting, revision checks, atomic mutation receipts and retry recovery; sandbox block messages and registered host actions; Agent cancellation, execution authorization and question continuations; credential encryption; browser sessions and origin grants; local data durability, snapshot validation and recovery; file/SQLite resource boundaries; dependency and build integrity (`docs/canvas-service.md`, `docs/dashboard-blocks.md`, `docs/agent-sessions.md`, `docs/browser-widgets.md`, `docs/local-widgets.md`).
- Excluded or accepted trade-offs: Cloud accounts, remote synchronization, multi-user tenancy, and cloud deployment are not current requirements unless explicitly scoped. Provider-backed Agent and voice features can require connectivity while the local canvas remains usable offline (`docs/agent-sessions.md`). Compatibility infrastructure is reviewed within its retained role, not imposed on new canvas features. Dependency/build/cache/generated output and sensitive local files follow the exclusions in `.agents/common-skills-policy.md`; nested repositories are outside scope unless separately configured and authorized.

## Technology and change impact

- Runtime and package tooling: TypeScript, Electron, React, Vite/electron-vite, Tailwind CSS, pnpm, and Turborepo (`package.json`, `apps/desktop/package.json`, `packages-ui/README.md`). Resolve supported Node from `.nvmrc` and root `engines`, pnpm from root `packageManager`, and dependency versions from the `pnpm-workspace.yaml` catalog; workspace manifests use `catalog:` and internal dependencies use `workspace:*`. Root scripts own commands (`docs/development.md`); prefer manifests over duplicated version prose. Before changing Turborepo configuration or commands, read the installed package's bundled documentation as required by `AGENTS.md`.
- Persistence: Main-owned, validated, versioned local JSON workspace snapshots with private temporary-file replacement in `apps/desktop/src/main/storage/workspace-file.ts`; paths/configuration in `apps/desktop/src/main/storage/`; runtime-neutral snapshot validation and repository adapters in `packages/workspace-model/src/repository/`. Canvas mutations and receipts share the atomic storage transaction (`docs/canvas-service.md`). Browser grants/tasks, local plugin files, host-owned SQLite storage, and shared resources have separate scoped stores (`docs/browser-widgets.md`, `docs/local-widgets.md`). Credentials use Electron safeStorage-backed owner-only ciphertext (`docs/agent-sessions.md`). No separate migration directory is configured; inspect version handling in each owning reader/validator. Data-directory migration is manual, with complete-directory backup guidance in `docs/application-configuration.md`; never inspect real product data during discovery.
- Infrastructure and deployment: `apps/desktop/package.json` builds the desktop with electron-vite. `.github/workflows/ci.yml` validates on Linux and macOS with frozen-lockfile installs; CI does not run runtime suites. Release preparation uses `scripts/release/`, `.changeset/`, and `docs/release-versioning.md` and does not publish or operate on Git. Signing, notarization, installers, automatic updates, and cloud deployment are not configured by the inspected tooling.
- Public contracts: Runtime-neutral exported desktop contracts and schemas in `packages/desktop-contracts/src/` and its `package.json` exports; compatibility contracts/re-exports in `apps/desktop/src/shared/`; typed preload capability composition in `apps/desktop/src/preload/`; capability-specific authorization in `apps/desktop/src/main/ipc/`. `docs/canvas-service.md` documents authenticated loopback HTTP, and `docs/dashboard-blocks.md` documents MCP tools and the sandbox block bridge. Domain and retained plugin contracts live in `packages/workspace-model/src/`, `packages/plugin-api/src/`, `packages/plugin-data/src/`, and `packages/plugin-ui/src/`.
- Cost dimensions: Desktop build/package size, startup latency, CPU/memory, browser and SQLite process resources, local storage growth including retained receipts, and backup/recovery effort. Current optional Agent/voice provider requests consume network and provider quota (`docs/agent-sessions.md`, `docs/local-widgets.md`, `docs/canvas-service.md`). Do not invent recurring cloud storage, synchronization, signing, or distribution costs for unimplemented capabilities.

## Verification

- Targeted checks: From `.` use the affected workspace's declared scripts with `pnpm --filter WORKSPACE lint`, `compile`, or `build` as applicable. Desktop behavioral tests use `pnpm --filter @avesd/desktop test:run TEST_FILE ...`, with paths relative to `apps/desktop`; the complete unit/integration suite is `pnpm --filter @avesd/desktop test`. Select other workspace tests from their manifests. Rendered behavior also needs focused visual QA; native Electron scenarios use `pnpm --filter @avesd/desktop test:e2e --grep SCENARIO` and need a graphical session (`docs/development.md`, `.agents/skills/ui-visual-qa/SKILL.md`). Preserve targeted IPC, permission, persistence, cancellation, and authorization coverage (`AGENTS.md`).
- Broad checks: Authoritative full-repository validation is `pnpm validate`, working directory `.` (repository root), as defined in `package.json` and `.github/workflows/ci.yml`. Run it once after broad/cross-package changes settle or when explicitly requested, plus relevant complete runtime test suites. It already includes root lint, compile, and build; runtime tests are separate. Documentation-only changes need content/reference review. Small isolated changes use affected checks; after fixes rerun only affected checks unless new evidence leaves a cross-cutting risk (`AGENTS.md`). Do not run broad verification merely to set up policy or publish an audit report.
- Report validation: Use repository-relative Markdown links with GitHub-style anchors. Check added links, trailing whitespace, and final newlines; run `git diff --check` only when Git work is separately authorized.

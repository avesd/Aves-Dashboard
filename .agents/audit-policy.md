# Repository Audit Policy

## Repository profile

- Repository purpose: A local-first, extensible desktop kiosk that grows with its user through replaceable plugins, with optional cloud capabilities deferred until they are needed.
- Artifact language: English.
- User communication language: Chinese by default, as required by `AGENTS.md`.
- Applicable instructions: Root `AGENTS.md` plus every nearer subtree `AGENTS.md` governing touched paths.

## Authority and decisions

- Current-contract sources: Root `AGENTS.md` owns cross-cutting boundaries; `README.md` owns current repository orientation; implementation and tests own behavior not yet described by durable domain documentation.
- Decision records: Not configured.
- Classification guide: Built into common audit skills.
- Conflict handling: Confirm behavior against current implementation and tests. Treat contradictions with `AGENTS.md` product, privacy, or Electron boundaries as unresolved defects or decision notes rather than silently choosing a new contract.

## Audit storage

- Scope log: `working/audits/log.md`.
- Scope-log entry format: Append `- YYYY-MM-DD HH:MM:SS ZZZ - Audited: <actual audit scope>` in English after scope confirmation; exclude findings, secrets, selection mechanics, and speculative notes.
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

- Protected invariants: Core workflows remain usable without cloud services; capabilities expand through replaceable plugins; renderer code has no direct privileged access; preload and IPC surfaces are narrow and typed; domain rules remain independent of Electron, React, persistence, and cloud implementations; sensitive user data and credentials are not logged or committed.
- Priority surfaces: Electron main/preload/renderer isolation, IPC validation, external navigation, local data durability, schema migration and recovery, file import boundaries, credential storage, dependency and packaging integrity, and future synchronization seams.
- Excluded or accepted trade-offs: Cloud accounts, remote synchronization, multi-user tenancy, and deployment infrastructure are not current requirements unless the user explicitly adds them to scope.

## Technology and change impact

- Runtime and package tooling: TypeScript monorepo using pnpm and Turborepo. Dependency versions belong in the `pnpm-workspace.yaml` catalog. Root scripts own normal development and verification commands.
- Persistence: Not configured. When persistence is introduced, audits must cover schema ownership, migrations, transactions, backups, export, recovery, and user-data durability.
- Infrastructure and deployment: Electron desktop build through `apps/desktop`; signing, notarization, installers, automatic updates, and cloud infrastructure are not configured.
- Public contracts: The typed preload API and IPC declarations under `apps/desktop/src/shared/` are the current renderer-to-main contract surface.
- Cost dimensions: Desktop package size and startup/runtime resource use; future recurring storage, synchronization, AI, network, signing, distribution, and support costs when those capabilities are introduced.

## Verification

- Targeted checks: Use the owning workspace's `lint`, `compile`, or `build` script, selected with `pnpm --filter <workspace>` when appropriate.
- Broad checks: Use `pnpm lint`, `pnpm compile`, and `pnpm build` for cross-cutting changes; `pnpm validate` combines all three.
- Report validation: Use repository-relative Markdown links with GitHub-style anchors. Check added links, trailing whitespace, and final newlines; run `git diff --check` only when Git work is separately authorized.

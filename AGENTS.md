# Avesd Core Monorepo

These instructions apply throughout the repository. A nearer `AGENTS.md` may
add subtree-specific constraints.

## Communication and repository language

- Communicate with the user in Chinese.
- Keep checked-in artifacts in English, including code, comments,
  documentation, commit messages, and pull-request text.
- If screenshots are used during a turn, include those screenshots in the
  final response to the user.

## Product boundary

- Avesd is a local-first spatial desktop workspace. Its primary interaction is
  a canvas that people and Agents can both change through explicit operations.
- The older dashboard and plugin systems are retained for compatibility and
  migration; do not make them dependencies of new canvas capabilities.
- Its core local workflow must remain usable without an account, network
  connection, or cloud service.
- Cloud accounts and synchronization are optional future capabilities, not
  current dependencies of the desktop application.

## Electron boundaries

- Renderer code must not access Node.js, Electron privileged APIs, the file
  system, credentials, or persistence directly.
- Expose privileged behavior through narrow, typed preload APIs and explicit
  IPC contracts.
- Keep domain rules independent of Electron, React, persistence drivers, and
  future cloud implementations.
- Treat user-created content, contact details, credentials, imported documents,
  and locally persisted data as sensitive. Do not place them in logs, fixtures,
  snapshots, or committed environment files.

## Repository mechanics

- Dependency versions belong in the `pnpm-workspace.yaml` catalog; workspace
  manifests reference them with `catalog:`.
- Root verification scripts are `pnpm lint`, `pnpm compile`, `pnpm build`,
  and `pnpm validate`; choose their scope using the verification policy below.
- `README.md` currently owns product orientation and repository onboarding.
- `working/` contains non-authoritative audits, plans, and temporary notes.
- Tests live under each workspace's `test/`, never beside production source.
  Unit tests mirror `src/` under `test/unit/`; integration tests use
  `test/integration/`, and native Electron scenarios use `test/e2e/`.
  Keep test sources covered by compile and lint when moving or adding suites.
- Package `src/index.ts` files contain re-exports only. Put types and behavior
  in responsibility-named files; use explicit names for executable entry points
  and configuration factories. Avoid internal barrels solely to shorten imports.

## Implementation readability

- Start maintained JavaScript and TypeScript source, test, and configuration files
  with the four-field header documented in `docs/development.md`. Use
  `@author Avesd`, `@package`, `@namespace`, and `@description`, followed by one
  blank line. Run `pnpm check:file-headers` or `pnpm fix:file-headers`; preserve
  existing descriptions and extra annotations. Generated declarations and output
  are excluded.
- Put each executable statement on its own line and expand control-flow blocks.
  Separate asynchronous test setup, actions, waits, and assertions into readable phases.
- Express business decisions with explicit branches or typed mappings, not nested
  ternary expressions. Name nontrivial state mappings and cover every known state.
- Model mutually exclusive lifecycle states explicitly. Keep independent lifecycles
  separate, derive redundant state when possible, and centralize state transitions.
- Preserve safe operational error codes and details. Convert unknown failures to
  safe messages at boundaries; never expose raw exceptions or sensitive inputs.
- Keep type assertions narrow and explain non-obvious invariants. Test observable
  behavior and failure recovery, including cancellation and authorization races.

## Proportionate verification

- Choose checks from the changed behavior, affected callers, and risk before
  running them. Use workspace/file-scoped lint, compile, and tests during edits.
- Documentation-only edits need a content/reference review. Local UI or wording
  changes need affected checks and, when rendered behavior changes, a focused
  visual check. Do not rerun unrelated Agent or IPC suites for these changes.
- For shared contracts, IPC, permissions, persistence, cancellation, or execution
  authorization, retain targeted behavioral tests and affected boundary checks.
  Similar scenarios at different trust boundaries are not automatically duplicates.
- Run full `pnpm validate` and relevant complete test suites once after broad or
  cross-package changes settle, or when explicitly requested. Small isolated
  changes do not require full-repository validation. `pnpm validate` already
  includes root lint, compile, and build; do not run those again separately.
- After a follow-up fix, rerun only checks affected by that fix. Repeat a full
  pass only when new evidence leaves a cross-cutting risk unresolved. Once the
  selected checks pass, stop; report what ran and any material coverage limits.
- Prefer tests of observable behavior and failure recovery. Delete or consolidate
  redundant tests and assertions that merely restate implementation, preserving
  unique edge cases and security/data-loss protection. Do not add tests for every
  reversible wording, style, or assembly change, or optimize for test count.
- Use `pnpm --filter @avesd/desktop test:run <test-file> ...` for targeted desktop
  tests (paths relative to `apps/desktop`); `pnpm --filter @avesd/desktop test`
  runs the complete desktop suite.

## Git handling

Do not inspect or mutate Git state unless the user explicitly asks for Git work
in that turn. Preserve unrelated user changes.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Common Skills Repository Policy

## Repository profile

- Repository purpose: A local-first spatial desktop workspace where people and Agents change persistent canvases through explicit operations, with optional cloud capabilities deferred (`AGENTS.md`, `README.md`).
- Artifact language: English.
- User communication language: Chinese by default, as required by `AGENTS.md`.
- Applicable instructions: Root `AGENTS.md` plus every nearer subtree `AGENTS.md` governing touched paths.
- Validation command: `pnpm validate`, working directory `.` (repository root); defined in `package.json` and run by `.github/workflows/ci.yml`. It includes lint, compile, and build, but not runtime tests (`docs/development.md`).

## Documentation and terminology

- Documentation index: `README.md` currently owns product orientation, repository layout, prerequisites, and command discovery.
- Current-contract sources: Root `AGENTS.md` owns cross-cutting boundaries and `README.md` owns product orientation and onboarding. Route canvas behavior to `docs/canvas.md`, `docs/canvas-service.md`, and `docs/dashboard-blocks.md`; presentation to `docs/design-language.md` and `packages-ui/README.md`; Agent execution and credentials to `docs/agent-sessions.md`; configuration to `docs/application-configuration.md`; development and release tooling to `docs/development.md` and `docs/release-versioning.md`. `docs/runtime-architecture.md`, `docs/local-widgets.md`, and `docs/browser-widgets.md` describe retained compatibility surfaces. Owning exported contracts, implementation, and tests supply executable details; record contradictions with governing instructions or current documentation instead of treating implementation as permission to change a contract.
- Canonical terminology: Use `AGENTS.md` for product boundaries, `README.md` for orientation, and the matching domain document for domain terms. `docs/canvas-service.md` calls a board a dashboard in the product while preserving canvas API names and storage identifiers. Distinguish current dashboard blocks from the retained legacy dashboard/widget/plugin runtime; preserve established exported names in the owning package.
- Working documents: `working/` is temporary and non-authoritative (`AGENTS.md`, `working/README.md`). `working/plans/` holds implementation plans, `working/notes/` investigations, and `working/archive/` useful completed context. Audits, plans, and notes must not override current code, tests, or durable documentation; delete, archive, or promote confirmed current behavior into durable documentation when work ends. Durable domain documentation lives under `docs/`, with the shared UI contract in `packages-ui/README.md`; storage alone does not confer authority.
- Audit context: `.agents/audit-policy.md`, `working/audits/log.md`, and `working/audits/reports/`.
- Inline documentation updates: Update the nearest current documentation when a user-approved decision changes an implemented contract. Do not silently establish product behavior only in a plan or audit report.
- Prohibited documentation patterns: Do not create parallel current-truth files such as `CONTEXT.md` or `CONTEXT-MAP.md`; do not treat plans, notes, handoffs, or audit reports as current contracts.

## Decision records

- Decision-record directory: Not configured.
- Decision-record guide: Not configured.
- Numbering and filename convention: Not configured.
- Decision threshold: Require all three: costly to reverse, surprising without context, and a real trade-off among credible alternatives.
- Relationship to current contracts: A future decision record may preserve rationale but must not replace current product, architecture, data, or API documentation.
- Replacement-link style: Follow the touched document.

## Git repositories and commits

- Root repository: `superproject` at `.`.
- Included nested repositories: None.
- Excluded repositories and paths: No additional repository is included; filesystem discovery found only the root Git boundary and no `.gitmodules` declaration. Do not enter, inspect Git state in, stage, commit, or update gitlinks for any subsequently discovered nested repository without explicit scope authorization. Dependency, build, cache, coverage, and generated output are excluded from routine inspection and staging: `node_modules/`, `.pnpm-store/`, `.turbo/`, `dist/`, `out/`, `release/` output, `coverage/`, `*.tsbuildinfo`, and generated declarations (`.gitignore`, `docs/development.md`). Maintained `scripts/release/` is source, not excluded release output. Do not read secret values or stage local environment files, credentials, product data, or OS/editor artifacts. User-authorized generated artifacts require an explicit path scope.
- Nested-repository commit order: Not applicable with no included nested repositories. Before including one, configure its ownership and exclusions; commit an authorized child first, then explicitly stage only its resulting gitlink in the parent. Never update an excluded child's gitlink.
- Status and history inspection: Inspect Git state or history only when the user explicitly authorizes Git work for the turn; common commit-planning skills may inspect the minimum included-repository context required by their direct invocation.
- Commit plan modes: `Compact`, `Balanced`, and `Detailed`; recommend `Balanced` by default.
- Commit identity: During authorized Git work, read the effective configured Git identity without changing local or global configuration; stop before committing if required identity is missing. Setup does not inspect identity.
- Commit message convention: English (`AGENTS.md`). During authorized commit work, infer style from the minimum recent subjects needed; no repository-specific prefix is established by this setup. Release changesets in `.changeset/` follow `docs/release-versioning.md` and do not define commit subjects.
- Staging restrictions: Only after commit authorization and plan selection, use `git add -- path/to/selected-file` or `git add -p -- path/to/selected-file` in the owning repository. Do not use `git add .`, `git add -A`, `git add --all`, unscoped `git add -u`, or `git commit -a`; preserve unrelated staged and unstaged work. Do not unstage excluded content without explicit instruction.
- Verification before commit: During authorized Git work inspect staged scope and run `git diff --cached --check`. Select checks using `AGENTS.md`: documentation-only changes need content/reference review; isolated code changes need affected workspace checks and behavioral tests; rendered changes need focused visual QA. Broad or cross-package changes need one settled `pnpm validate` pass plus relevant complete test suites. Validation omits runtime tests; follow-up fixes rerun only affected checks unless evidence leaves a cross-cutting risk. Do not repeat lint, compile, and build after validate.
- Post-commit actions: Do not amend, rebase, push, force, discard, reset, bypass hooks, or modify Git configuration unless separately requested.

## Plan discussion and review

- Repository exploration: Prefer answering discoverable questions from applicable instructions, manifests, code, tests, and current documentation before asking the user.
- Required review authority: Applicable `AGENTS.md`, the documentation and terminology routing above, relevant exported contracts, manifests, implementation, and tests. Check overlapping plans and audit reports as non-authoritative evidence. Decision records are not configured.
- Independent plan review: `review-plan` must use exactly one newly spawned clean-context agent with no inherited conversation history. The reviewer is read-only and cannot delegate.
- Documentation during grilling: Resolve one decision branch at a time and update the matching current document immediately when the user confirms a durable contract.

## Handoff

- Output location: The operating system temporary directory, never the repository workspace.
- Filename convention: Use a collision-resistant temporary Markdown filename containing `handoff`.
- Required sections: Objective, current state, confirmed decisions, unresolved questions, relevant artifacts, verification and failures, exact next steps, and suggested skills.
- Sensitive information: Redact credentials, tokens, secret values, private keys, user-created content, personal contact details, imported documents, locally persisted data, and other personally identifiable information.
- Existing-artifact references: Reference existing plans, decisions, commits, diffs, reports, and documentation by path or URL instead of duplicating them.

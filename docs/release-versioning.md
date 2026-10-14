# Release versions and changesets

## Version ownership

`apps/desktop/version.json` owns the prepared desktop release version, starting
at `0.1.0`. This is release metadata; it does not configure Electron installer
packaging or change the version reported by `app.getVersion()`. Internal private
packages are not independently versioned or published.

The release scripts are adapted from Tips. They implement its changeset Markdown
format, version skip rules, per-target changelogs, and annual consumption history.
They only prepare local files: no Git inspection, commits, tags, publishing,
deployment, account, or network access is part of these commands. pnpm's native
`change` and `version -r` commands do not implement this adapter.

Targets are discovered from immediate workspace groups in `pnpm-workspace.yaml`.
A workspace with `version.json` is an application release target (the internal
manifest kind is `deployment`). Otherwise, a workspace with `private: false` and
a stable version in `package.json` is a package release target. Private packages
without `version.json`, symlinked workspaces, and nested workspace patterns are
excluded. Future public packages can opt in without changing the release scripts.

## Record a change

Run `make changeset` in an interactive terminal. Select targets with the arrow
keys and Space, then press Enter. Choose a patch, minor, or major bump for each
target, enter an English summary, and confirm the preview. Escape, Ctrl+C, or
negative confirmation cancels without writing a note or changing versions.

For noninteractive use:

```sh
make changeset TARGET=apps/desktop BUMP=patch SUMMARY="Fix canvas keyboard navigation."
```

`BUMP` defaults to `patch`. `TARGET` accepts comma-separated exact workspace paths
when recording a note. Package names, aliases, unknown paths, and traversal paths
are rejected. A note can request different bumps for different targets when
edited before consumption. Creating a changeset never bumps a version.

Pending notes live at the repository root in `.changeset/*.md`:

```markdown
---
apps/desktop: patch
---

Fix canvas keyboard navigation.
```

The matching pnpm scripts are `pnpm changeset`, `pnpm version-dry-run`, and
`pnpm version-packages`. For noninteractive pnpm calls, use
`AVESD_CHANGESET_TARGET`, `AVESD_CHANGESET_BUMP`, and `AVESD_CHANGESET_SUMMARY`.
Make exports these values from `TARGET`, `BUMP`, and `SUMMARY` without inserting
the summary into a shell command.

## Preview and apply

```sh
make version-dry-run
make version-packages
```

Use `TARGET=apps/desktop` with either command to select only that target. Planning
prints each pending target's current version, next version, bump, and manifest.
It writes nothing. Multiple notes produce one release per target: the largest
bump wins and every contributing summary is retained. Unnamed targets are not
bumped; dependency changes do not automatically bump consumers. Record a desktop
changeset for an internal package change that should ship in a desktop release.

Version calculation follows the Tips rules. It skips versions whose digits are
all equal or form a consecutive ascending or descending sequence. For example,
patch bumps map `2.2.1` to `2.2.3`, `1.2.2` to `1.2.4`, and `3.2.0` to `3.2.2`.
The desktop's first patch bump from `0.1.0` is `0.1.1`.

Application updates the selected version manifests, prepends each target's
`CHANGELOG.md`, appends consumption records to the current UTC year's history,
and deletes fully consumed notes. A note naming multiple targets remains pending
until all its targets consume it. Repeated applications do not bump those targets
again. Dependency ranges and the lockfile are not rewritten by these commands.
Review the complete prepared file set together; publishing and installer setup
remain separate work.

## History and consistency

```text
.changeset/change-<uuid>.md
apps/desktop/version.json
apps/desktop/CHANGELOG.md
apps/desktop/.changeset/history/2026.yaml
apps/desktop/.changeset/history/2027.yaml
```

Changelogs and history files are created on the first applied release, not during
initial configuration. Each history entry records the previous version, bump,
manifest kind, note IDs, and SHA-256 note digests. Each target owns one `YYYY.yaml`
file per UTC year; only the current year's files for released targets are written.
Older files remain authoritative and are never automatically removed.

Once any target consumes a note, the entire note is immutable, including its
target list and summary. Create a new note for subsequent changes. Planning reads
all discovered targets' history, even for a selected-target release, and rejects
changed consumed notes, conflicting digests, duplicate consumption, and reused
versions. Before applying a plan, the scripts recheck recorded history files,
planned notes, and selected versions and fail if those inputs changed.

## Validation

`pnpm lint` includes a read-only release plan check, so CI rejects invalid pending
notes or histories without applying them. `pnpm compile` type-checks release
scripts and their tests. `pnpm test` exercises discovery, version rules, previews,
application, partial consumption, year rollover, and stale-input rejection using
temporary repositories. `pnpm validate` includes all these checks.

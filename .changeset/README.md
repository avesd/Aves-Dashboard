# Pending release changes

Run `make changeset` from the repository root. Record an English summary and
select the release targets and bumps. Run `make version-dry-run` before
`make version-packages`.

This directory owns pending notes. Each release target owns its changelog and
annual consumption history in `.changeset/history/YYYY.yaml` next to its version
manifest. New records use the UTC year when versions are applied. All years
remain available to consumption checks.
See [the release contract](../docs/release-versioning.md).

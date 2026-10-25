# GridUI migration handoff

Status: source migration prepared; waiting for the user to publish the GridUI
changes before installing the new version and performing final validation.

## Current scope

OBJECTIVE: migrate the controller composer, runtime popover, collections, feedback
and transcript primitives to GridUI while preserving Avesd interactions and identity.
DONE: source migration and upstream public APIs are prepared for publication,
with redundant controller mechanics removed and regression scenarios ready.
NON-GOALS: Markdown extraction, selection decoration, domain/IPC changes.
CONSTRAINTS: no Git work or publication; defer all validation and visual checks
until the user publishes the updated GridUI dependency.

## Upstream changes

The GridUI repository at `/Volumes/SN850/Git/GridUI-React-Monorepo` contains:

- Optional `SidebarGroup.label`, without an empty heading or inaccessible ID
  reference, preserving caller-provided accessible names.
- Public Input/Label, Popover and DataBadge/DataBar/DataValue prop type exports.
- Composer configurable submission shortcuts, independent editing/submission
  during busy state, native textarea props/ref, inline layout and custom submit
  button content/props. Existing default behavior remains unchanged.
- Disclosure summaryClassName for compact transcript presentation.
- Composer busy/guard unit coverage, inline supplement Storybook example and
  browser scenarios for Enter, Shift+Enter, IME, event cancellation and ref focus.
  These scenarios are authored but have not been run.
- Sidebar tests, an unlabeled Storybook case, documentation and pending minor
  changeset `0a749d5b-84d5-44fd-961d-3904d534f92e`.

No version bump, publication, Git operation or upstream validation was performed.

## Avesd changes

Generic controls, geometry, data displays, sidebar behavior and class merging now
re-export GridUI. Redundant implementations and unused old convenience components
are removed. Selection and geometry tests exercise the public component contract
instead of copied private algorithms. Avesd retains its bird mark, canvas
selection decoration, identity tokens and product interactions.

Select callers explicitly request item alignment. Settings supplies its resize
width formatter. No local compatibility components remain. Avesd's theme uses
GridUI variables with the original green seed and local font stack.

Controller high-priority migration is also prepared:

- Composer replaces the local form/key handling; Avesd still owns request admission.
- Popover replaces custom positioning, document outside-click and focus handling.
  Select/Combobox portals mount inside the popup. A new native Electron scenario
  covers nested selection, layered Escape, close-button focus and outside dismissal.
- CollectionItem/Button replace Canvas and Session row scaffolding. InlineNotice
  replaces runtime and error feedback. Disclosure and CodeView render tool output.
- useFollowScroll replaces the manual scroll flag/effect, using a 60-pixel threshold
  and resuming on submission. Existing viewport, hidden panels and draft refs remain.
- Old spacing utilities in the runtime picker and voice buttons are migrated;
  obsolete composer, collection, popup-positioning and duplicate control CSS is removed.
- The native submission scenario also covers Shift+Enter, IME and busy Enter submission.

## Resume after publication

1. Obtain the published version from the user or registry; do not assume its number.
2. Update all six GridUI catalog versions together and run `pnpm install` once.
   The current catalog and installed packages are still 0.3.0. Manifest cleanup
   is intentionally not yet synchronized to `pnpm-lock.yaml`.
3. Run GridUI's `make validate` if the release has not already been validated,
   include GridUI browser Composer scenarios (`ui-workflow-components.spec.ts`),
   then one Avesd `pnpm validate` plus the complete affected Controls, Grid,
   Layout and Renderer Agent suites.
4. Run the native Electron controller (including `controller-runtime-picker.spec.ts`),
   settings sidebar, selection/menu and submission scenarios. Inspect screenshots for light/dark themes, selected-item
   alignment, popup focus/Escape, collapsed/expanded/narrow sidebars, controller
   footprint and chat drafts. Use only disposable synthetic data.
5. Fix observed regressions in the owning repository; keep generic capability
   fixes upstream. Rerun only checks affected by a fix.

Earlier intermediate checks passed before the final cleanup and upstream API
changes. They are not final migration verification. At the user's request no
further checks run until the updated dependency is published and installed.

Temporary baseline/intermediate screenshots and the native capture script are in
`/tmp/avesd-gridui-visual/` and `/tmp/avesd-gridui-visual.mjs`. Retired source backups
are under `/tmp/avesd-gridui-retired-source/`. They are review aids, not maintained
implementations or final acceptance artifacts.

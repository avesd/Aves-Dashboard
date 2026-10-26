# Avesd UI

The trusted desktop UI consumes the six responsibility-based GridUI packages.
`@avesd/ui-*` packages provide stable application import paths, public GridUI
re-exports, Avesd identity tokens, and the small amount of product-specific art.
Generic component behavior belongs in the GridUI repository. Add missing public
capabilities there instead of maintaining parallel implementations or compatibility
components here.

| Owner | Responsibility |
| --- | --- |
| `ui-theme` | GridUI theme integration and Avesd brand/font overrides |
| `ui-style-utils` | GridUI `cn` and `ClassValue` re-exports |
| `ui-controls` | GridUI forms, inline editors, confirmation dialogs, tabs, selection, popups, collections and follow-scroll re-exports |
| `ui-grid` | GridUI responsive geometry and frame re-exports |
| `ui-data` | GridUI data displays, inline notices and Avesd canvas selection decoration |
| `ui-layout` | GridUI sidebar and composer re-exports |
| `ui-logo` | Avesd bird geometry and React SVG rendering |
| `packages-renderer/*` | Domain state, requests, labels, operations and desktop composition |

Keep GridUI versions aligned in the root catalog. Each owning UI package declares
its corresponding GridUI dependency. Renderer consumers import collections and
follow-scroll from `@avesd/ui-controls`, inline notices from `@avesd/ui-data`,
and sidebar and composer compositions from `@avesd/ui-layout`. This system remains
independent of the framework-neutral legacy `@avesd/plugin-ui` contract and of
privileged Electron services.

## Styles and identity

Each renderer imports Tailwind's theme and utilities, then the Avesd theme and
Controls, Grid, Data and Layout styles, in that order. Layout must follow its
foundation styles. The Avesd theme loads GridUI's raw Tailwind theme entry and
compiled reset, followed by `theme/src/identity.css`. This supplies one reset
policy while allowing application utilities to use GridUI's semantic mappings.
The published component styles already contain library utilities; do not scan
GridUI source or compiled output. Scan only renderer and local UI source.

HTML heads declare `theme, base, components, utilities` before bundled styles.
Application CSS uses `--gridui-*` semantic variables. Avesd overrides the brand
seed with `#35615a`, retains the existing local Inter/system fallback stack, and
uses the body stack for display text. GridUI supplies the shared palettes,
spacing, typography, focus and motion values. Appearance remains controlled by
`data-theme="light"` / `"dark"` or the OS preference. Do not use GridUI's browser
storage helpers to bypass the desktop's persistence boundary.

`--avesd-selection-glow`, `--avesd-selection-color` and
`--avesd-selection-corner-size` remain specific to Avesd canvas decoration.
The bird mark inherits its current text color. No network fonts are required.
Use native props, public variants and `className` for customization; do not patch
private GridUI descendants from renderers.

Controller and Settings presentation uses explicit local classes for headings,
action buttons, route fields, feedback, and surrounding layout. Ordinary styles
do not rely on element tag names or child positions. Retained CSS keeps cascade
order, responsive rules, and application layout in the renderer.
Typography roles use complete font tokens. Scope a public `--gridui-type-*`
token when adjusting a role size while retaining its font family and weight,
as the controller navigation does for narrow windows.

## Interaction contracts

The settings and controller Select callers explicitly set
`position="item-aligned"`; GridUI's general default is `popper`. GridUI owns
selection, grouping, Unicode search, disabled choices, form/reset integration,
keyboard navigation and popup positioning. Consumers own saved routes, unavailable
value labels and operations. The controller uses a click-only GridUI Popover anchored to the runtime row.
Nested selections receive the PopoverPanel element as `portalContainer`, keeping
choices inside its focus/dismissal boundary. GridUI owns positioning, outside
interaction, Escape and return focus; no document-level dismissal listener remains.

Sidebar groups may omit a title without reserving label space. Callers can name
an unlabeled group using `aria-label` or `aria-labelledby`. Sidebar resizing,
collapse and compact layout belong to GridUI. Settings supplies `formatWidth`
for its existing spoken pixel units. Draft-bearing settings panels stay mounted
with `hidden`; the application owns drafts and future persistence.

Controller panels use GridUI Tabs for keyboard navigation and tab/panel associations.
The conversation panel stays mounted to retain its draft, runtime selection and
scroll observers. The voice connection remains outside the panel lifecycle.
Settings and runtime fields use Fieldset, Field, Label and FieldNote; asynchronous
feedback uses InlineNotice. Row, Stack and Split own shared alignment, spacing and
structural seams, while renderers retain window dimensions and product placement.

API key entry uses InlineEditor with a password field, independent submit
disabledness and native constraints. Avesd clears the draft before an authorized
save, checks revisions and owns duplicate-request protection. AlertDialog owns
deletion confirmation, focus isolation and Escape; the caller retains deletion
authorization and asynchronous error handling.

The catalog remains on published GridUI 2.0.0. A version-specific pnpm patch in
`patches/` carries the compiled upstream InlineEditor enhancement until its pending
Controls minor changeset is released. The patch includes its public declaration
and needs no local repository link. Remove it when upgrading to a release containing
submitDisabled, editButtonProps, native validity checks and deferred focus recovery.

The controller configures GridUI Composer with inline layout, Enter submission,
Shift+Enter newlines, editable/submittable busy state, a 32,000-character limit and
its existing textarea ref. GridUI owns keyboard/IME handling, button guards and
input composition. Avesd owns admission, supplemental request queues, draft
clearing, errors and cancellation.

Canvas and Session rows use CollectionItem and CollectionItemButton. Runtime and
error notices use InlineNotice. Transcript details use Disclosure and CodeView;
compact summary styling uses the public summaryClassName prop. useFollowScroll
owns content/viewport observation and following within 60 pixels of the end;
submission resumes following. Avesd keeps its existing viewport and does not add
a jump button. Domain event interpretation, Markdown policy, the free canvas,
desktop window behavior, voice state, authorization, IPC and persistence remain
application responsibilities.

The former unused NativeSelect, DetailDialog, DetailLayout and SectionHeading
exports have been retired. Use GridUI public form, modal and layout components
when adding new compositions rather than restoring those local implementations.

## Verification

- `pnpm --filter @avesd/ui-controls test` checks public selection behavior,
  Unicode search, form/reset handling, disabled recovery and nested Escape.
- `pnpm --filter @avesd/ui-grid test` checks the public rendering contract for
  responsive tracks, row filling and invalid spans.
- `pnpm --filter @avesd/ui-layout test` checks sidebar names, navigation,
  controlled state, resizing and compact recovery.
- `pnpm --filter @avesd/renderer-agent test` checks saved route choices.
- `pnpm validate` covers lint, types, dependency boundaries and production builds.

Use the native Electron scenarios for controller submission/focus, settings draft
retention, resize cancellation and narrow-window recovery. Inspect real rendered
screenshots in light/dark appearance and relevant popup states after dependency
versions and implementation changes have settled. These tests do not replace
upstream GridUI's own package and browser coverage.

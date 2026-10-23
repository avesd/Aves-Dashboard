# Avesd UI

The trusted desktop UI uses a responsibility-based component system migrated
from the local Tips UI implementation. It uses React, TypeScript, Tailwind CSS
v4, Radix Dropdown Menu, Base UI Select/Combobox, CVA, and semantic CSS variables. Avesd keeps its own
brand mark, local system fonts, desktop window behavior, and free spatial canvas.

| Owner | Responsibility |
| --- | --- |
| `ui-theme` | Semantic palettes, typography, spacing, focus, motion, and Tailwind mappings |
| `ui-style-utils` | Class composition and theme-aware Tailwind conflict resolution |
| `ui-controls` | Buttons, inputs, Select/Combobox, context/dropdown menus, and detail dialogs |
| `ui-grid` | Responsive geometry, page frames, regions, rails, and continuous boundaries |
| `ui-data` | Value/badge/bar presentation and decorative selection geometry |
| `ui-layout` | Section headings, detail compositions, and grouped sidebar layouts |
| `ui-logo` | Avesd bird geometry and React SVG rendering |
| `packages-renderer/*` | Domain state, requests, labels, operations, and desktop-specific composition |

Foundations do not import Layout, domain contracts, or renderer packages.
Layout composes foundations without loading domain data. Repository boundary
validation checks source imports and dependency declarations. Use declared
`workspace:*` dependencies and public package exports. Package `src/index.ts`
files contain re-exports only. This system is separate from the framework-neutral
legacy `@avesd/plugin-ui` contract.

## Styles

Each renderer imports Tailwind, Theme, and the required package styles once in
its stylesheet entry and explicitly scans both its own `src/**/*.{ts,tsx}`
and `packages-ui/*/src/**/*.{ts,tsx}`. The Electron
renderer Vite configuration owns Tailwind compilation. HTML heads declare the
cascade order `theme, base, components, utilities` before bundled styles.

Ordinary presentation belongs in colocated `style.ts` files using named CVA
styles and semantic utilities. Retain CSS for inherited geometry, region tones,
keyframes, and complex structures. Computed geometry uses inline custom
properties. Override through native props, semantic variants, and `className`;
do not patch private descendant selectors from a consuming renderer.

Theme supplies `background`, `foreground`, `muted`, `accent-background`,
`accent-foreground`, `border`, and `surface` roles in both appearances.
`--avesd-brand-seed` owns the Avesd accent. `data-theme="light"` or `"dark"`
forces appearance; otherwise the OS preference applies. Typography uses complete
`type-*` roles. Fonts use local fallbacks and do not require network access.

## Grid and boundaries

`Grid` supports responsive equal or automatic tracks, spans, padding, and
optional last-row fill. Breakpoints remain 40rem and 64rem. `frame="cells"`
owns all cell edges; `frame="internal"` supplies seams inside an existing frame.
Framed grids reject explicit gaps. `fillLastRow` requires direct `GridItem`
children and fills incomplete rows without shifting earlier complete rows.

`PageFrame` and `FrameSection` own page edges and leading section boundaries.
Section tones are neutral, brand, warning, or danger. Boundary variants are
line, band, stripe, space, and none. Adjacent regions share one separator.
Controls own their own borders; data displays own data presentation. Settings,
controller regions, menus, and details share this language. Canvas content stays
freely positioned, with no permanent page frame or forced tiling.

## Verification

Run `pnpm --filter @avesd/ui-grid test` for geometry and responsive planning. Run
`pnpm --filter @avesd/ui-controls --filter @avesd/renderer-agent test` for
selection filtering and saved-route choice recovery.
The full `pnpm validate` includes UI workspaces and dependency boundaries.
Rendered changes also require focused visual QA using production styles and
safe state; native behavior requires the actual Electron application.

## Selection and context menus

`Select` and `Combobox` use Base UI interaction primitives. Select aligns the
selected item with its trigger when opened, with automatic viewport fallback.
`position="item-aligned"` is the default; `position="popper"` opens against the
trigger edge with an 8px gap. Both modes match the trigger width and horizontal
edges. Select reserves a trailing checkmark slot so item text alignment does not
push the menu outside the trigger's left edge.
Combobox uses an editable trigger input, following the shadcn composition. Both reuse Tips
input, popup, option, focus, and motion styles, and support grouped options,
keyboard navigation, disabled choices, and empty-state feedback. Combobox typing
filters names and IDs without committing a value; choosing an option commits its
stable ID. Dismissing unfinished input restores the selected label. A hidden native select retains form association and reset behavior; it
does not display a system picker. Consumers own route changes and requests.
Agent and Effort use Select; Model uses Combobox in Settings and the controller.
Model search matches names and IDs. Saved unavailable values remain visible.

Within `controls/src/select`, `select.tsx` and `combobox.tsx` own their distinct
primitive compositions; `select-options.tsx` and `combobox-options.tsx` render
the corresponding option primitives. `types.ts` defines the common selection
contract without coupling either component to the other. `use-selection-state.ts`
owns values, availability guards, reset, and open-state transitions.
`selection-form.tsx` owns native submission, constraint validation, and canceled
reset handling. Base UI continues to own navigation, query state, and positioning.

Use `portalContainer` when a selection belongs to an existing overlay owner.
The controller mounts nested selection layers in its runtime-picker owner so
its outside-click handling includes the portalled options. Escape closes the
innermost selection and restores its trigger before closing the outer dialog.

`ContextMenu` anchors the shared Radix dropdown primitives to viewport x/y
coordinates, handles viewport collisions, keyboard navigation, outside dismissal,
and window blur. Consumers supply `DropdownMenuItem` children and own operation
callbacks and focus restoration. The canvas no longer implements a separate
menu keyboard or positioning system.

## Sidebar layouts

`SidebarLayout` owns container geometry, expansion and expanded width. Compose
`Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarItem` or
`SidebarLink`, `SidebarFooter`, and `SidebarMain`. Add `SidebarToggle` and
`SidebarResizeHandle` for explicit collapse and resizing. Import layout styles
once alongside the foundation styles. Give the layout a bounded height so the
navigation and main content scroll independently while the header/footer remain
visible. The layout stays inside its parent; it does not use viewport-fixed
positioning or a compensating spacer.

Use `SidebarHeader`'s `title` for text hidden in icon mode, keeping interactive
children mounted so collapse does not lose toggle focus. `SidebarFooter` accepts
optional `collapsedContent` for a compact footer. Groups own their lists; place
items directly inside them. Items require an icon and text label. Buttons select
local sections; links preserve native anchor behavior. Active items expose
`aria-current="page"`. Consumers own selection, routing, labels, data and drafts.
Group labels are optional; omit them for a single obvious group and use
`aria-label` or `aria-labelledby` when it needs an accessible name. Keep
draft-bearing panels mounted with `hidden` when switching local sections.

The expanded width defaults to 216px, bounded by 192–360px. `defaultWidth`,
`minWidth` and `maxWidth` customize it. Left and right sidebars use direction-aware
pointer and keyboard resizing. Arrow keys move 16px, Home/End reach the limits,
and double-click resets to the default. Escape, pointer cancellation, lost
capture and window blur restore the width from before a drag. Collapse retains
the expanded width. Below a 640px container width, navigation uses a 60px icon
rail; restoring the container restores the user's expansion preference. This is
a desktop compact layout, not a modal mobile drawer. Motion respects reduced
motion preferences and is disabled during dragging.

Use `expanded`/`onExpandedChange` and `width`/`onWidthChange` for controlled state;
omit values for internal state. `onWidthCommit` fires after completed drag,
keyboard adjustment or reset, not cancellation. The component does not write
cookies, local storage or desktop preferences, and does not register a global
keyboard shortcut. Applications own persistence through their authorized APIs.
The settings window currently retains presentation state only while mounted.

Files under `layout/src/sidebar/` separate layout/context, regions, navigation,
toggle and resize behavior. `style.ts` owns ordinary semantic presentation;
`styles.css` owns inherited geometry and scroll behavior. Run
`pnpm --filter @avesd/ui-layout test` for component contracts and the settings
sidebar Electron scenario for native pointer geometry and draft retention.

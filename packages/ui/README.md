# Avesd UI

`@avesd/ui` is the internal React component library for trusted Avesd product
surfaces. It owns shared design tokens and accessible visual primitives. Product
features keep their data loading, state, and domain behavior in the consuming
application.

The [Avesd design language](../../docs/design-language.md) owns the approved
visual direction and presentation rules. Shared `--avesd-field-*` tokens supply
the dashboard's light and dark content field, readable foregrounds, and local
emphasis. Other components are not yet a complete implementation of that
specification.

Import `@avesd/ui/styles.css` once at the renderer entry point, then import
components from `@avesd/ui`. Prefer semantic variants and CSS variables over
feature-specific color values. Extend the library when the same visual pattern
is used by more than one product surface or when a shared accessibility behavior
belongs with the component.

This package is separate from `@avesd/plugin-ui`. The latter is a framework-neutral
plugin contract and does not expose host React components to sandboxed plugins.

## Selection indicator

`SelectionIndicator` supplies four open corner marks and a restrained radial
glow. Render it inside a positioned, isolated host (`position: relative` and
`isolation: isolate`, or an already-positioned canvas object):

```tsx
<article className="selectable-object" aria-current={selected ? "true" : undefined}>
    <SelectionIndicator active={selected} />
    {content}
</article>
```

The host owns selection, focus, hit testing, and accessible state. The indicator
is decorative, ignores pointer events, and renders nothing when inactive. Its
negative stacking level keeps the glow behind content within the isolated host.
Keep the host's padding clear of the corner marks; avoid clipping the indicator.
It accepts native span props and refs, while `aria-hidden` is always true.

`--avesd-selection-color` defaults to the field emphasis color;
`--avesd-selection-corner-size` defaults to 18px, capped at 25% of each axis;
`--avesd-selection-glow` supplies the light/dark radial fill. The default stroke
is 1px. These sizes scale with the host's transform. There is no animation or
blur dependency; forced-colors mode retains the corner geometry with Highlight.

## Framed detail layouts

See [Framed detail layouts](docs/layout-grid.md) for Frame, FrameSection, Grid,
GridCell, DetailLayout, and DetailDialog. These shared components provide
continuous square borders for focused inspection while the canvas stays unframed.

## Bird mark

Use `BirdMark` for the six optical variants of the Avesd logo. `detail` selects
`full`, `regular`, or `compact`; `variant` selects `outline` or `solid`. The mark
inherits the current text color and accepts standard SVG sizing and class props.

```tsx
<BirdMark detail="compact" variant="solid" width={24} height={24} />
```

The mark is hidden from assistive technology by default. Supply an `aria-label`
when it is the only visible brand name. Standalone SVG sources are in
[`assets/brand`](../../../assets/brand/README.md).

## Component styling

Use the exported `cn` helper (`clsx` followed by `tailwind-merge`) to compose
conditional classes and resolve Tailwind utility conflicts. Component variants
live in colocated `style.ts` files using `class-variance-authority`. Production
styles currently use semantic CSS classes and Avesd tokens; `cn` does not generate
Tailwind CSS, and consumers need their own Tailwind build to use utility classes.

## Dropdown menus

Dropdown components wrap Radix Dropdown Menu and retain its native props,
events, and React 19 refs. Import `DropdownMenu`, `DropdownMenuTrigger`,
`DropdownMenuContent`, and the item components from `@avesd/ui`.

```tsx
<DropdownMenu>
    <DropdownMenuTrigger asChild>
        <Button variant="secondary">Actions</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={openSettings}>
            Settings
            <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
        </DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>
```

The full composition includes Group, Label, Separator, CheckboxItem, RadioGroup,
RadioItem, Sub, SubTrigger, SubContent, ItemContent, ItemAppearance, and Portal
(all prefixed with `DropdownMenu`). ItemContent supports icons, title adornments,
and ReactNode descriptions. Shortcut only displays a hint; the application owns
shortcut registration. ItemAppearance is visual only, with no menu semantics.

Root supports controlled and uncontrolled open state. Items support `disabled`,
`onSelect`, and `asChild`; checkboxes support `onCheckedChange` and indeterminate
state. Prevent the select event's default action to keep the menu open. Prefer
`onSelect` over pointer-specific handlers for keyboard activation.

Content and SubContent include a Portal; do not wrap them in another Portal.
Use `portalProps` for a custom container or forced mounting. Content retains
Radix placement/collision props and adds `margin` (`none`, `small`, `medium`,
`large`). For precise collision-aware spacing, use `margin="none"` with
`sideOffset`. Items expose `variant="destructive"` and `isUseCursorPointer`;
labels expose `fontWeight`; radio items can hide indicator padding while their
group has no selection. Motion respects reduced-motion preferences.

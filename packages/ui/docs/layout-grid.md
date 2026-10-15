# Framed detail layouts

Avesd uses unframed content on the canvas and continuous boundaries for focused
detail inspection. Both modes share the product palette and typography. Framed
layouts live in `@avesd/ui`; they do not depend on Tips or the legacy plugin UI.
Import `@avesd/ui/styles.css` once before rendering the components.

## Components and boundary ownership

| Component | Responsibility |
| --- | --- |
| `Frame` | One square outer border, an opaque surface, and inherited frame tokens |
| `FrameSection` | A semantic section; one leading separator between adjacent sections |
| `Grid` | Internal cell seams and responsive columns, without an outer border |
| `GridCell` | Cell padding, wrapping, and an opaque background |
| `DetailLayout` | A framed title/action row, caller-provided sections, and optional footer |
| `DetailDialog` | Controlled native modal presentation of a DetailLayout, with close action and focus restoration |

Keep FrameSection elements as direct children of Frame or DetailLayout so one
component owns each horizontal boundary. Use `padding="none"` for a section
containing a Grid. Do not wrap each cell in another Frame or add consumer borders
to recreate the same seam. There are no default rounded corners or card shadows.

Grid accepts `columns={1 | 2}`, defaulting to two. It uses one column below a
32rem container width, regardless of viewport size. Two-column grids expand an
odd final cell across the last row so there is no exposed seam-colored filler.
Its children must be direct GridCell elements; omit empty cells rather than
wrapping cells in additional DOM elements. Numeric spans, nested page rails,
and arbitrary track recipes are intentionally outside the initial API.

Grid owns a 1px gap with the boundary color beneath opaque cells. Frame owns a
1px outer border; FrameSection owns a 1px leading boundary. Layouts do not clip
focus outlines. Focused cells paint above their neighbors. Native HTML props,
class names, inline styles, and React refs are forwarded by Frame, FrameSection,
Grid, and GridCell; composition props are consumed rather than sent to the DOM.

`--avesd-frame-border` and `--avesd-frame-surface` inherit the shared field
palette. Configure these on the Frame when a contextual surface requires it.
Typography and content semantics remain with the consuming feature. Frame and
Grid do not invent headings, data fields, or product actions.

## Composition

```tsx
<DetailLayout title="Source details" actions={closeAction}>
    <FrameSection>
        <p>{source.title}</p>
    </FrameSection>
    <FrameSection padding="none" aria-label="Source information">
        <Grid>
            <GridCell>
                <h3>Origin</h3>
                <p>{source.url}</p>
            </GridCell>
            <GridCell>
                <h3>Excerpt</h3>
                <p>{source.excerpt}</p>
            </GridCell>
        </Grid>
    </FrameSection>
</DetailLayout>
```

DetailLayout is presentation only. It can be embedded in an existing surface
without introducing modal behavior. It accepts `title`, `titleId`, `actions`,
and `footer`, plus Frame's native props. Its title renders as an h2.

DetailDialog accepts `open`, `title`, `onClose`, optional `closeLabel`, and section
children. The native dialog supplies background inertness and focus containment.
Escape and the visible close action request closure; the caller sets `open` to
false or unmounts the dialog. Closing restores the invoking element when it still
exists. If a feature removes that element, the feature owns a sensible fallback.
Backdrop clicks do not dismiss the dialog. The body scrolls within the available
window height; long text must wrap within cells.

## Initial consumer and verification

Canvas object details display authored text, source URLs and excerpts, evidence
snapshots, and group membership. The application owns those meanings and data;
the UI library owns the geometry and modal behavior. Inspection never writes
canvas state or adds manual editing.

The desktop browser component suite loads the production styles and verifies
detail opening, Escape and explicit closure, focus restoration, a single internal
seam, a filled final row, responsive stacking, and long-content scrolling. The
native canvas scenario verifies modal inspection alongside existing canvas
interaction. Visual QA uses synthetic content in actual Electron windows.

# Avesd design language

Status: Approved visual direction, October 14, 2026. The current canvas uses
the light field and independent Agent-authored HTML/CSS/SVG blocks. The fixed
content renderers and their selection and relationship presentation have been
removed. Content examples below are visual guidance, not fixed component
types or claims about current rendering capabilities.

Avesd combines the spatial atmosphere of a light field with the clarity of
precise projection. Content appears directly in a continuous workspace.
Typography, placement, light, and meaningful relationships establish hierarchy.
Interface controls appear when needed and recede when the interaction ends.

This document owns the product's visual and interaction presentation rules.
[Canvas architecture](canvas.md) owns supported dashboard interactions and
window behavior; [Canvas service](canvas-service.md) owns operations and
authorization. Visual examples do not introduce new product capabilities.

## Core principles

### Content occupies the space

The resting dashboard shows the user's content. Do not surround it with
permanent top bars, bottom bars, sidebars, navigation rails, Agent docks, or
status strips. Avoid persistent logos, instructional copy, and decorative
headings that compete with the workspace. User-authored titles and labels are
content and remain appropriate.

Text, images, sources, and conclusions do not require a card around each object.
Use separation, alignment, and readable type before adding a surface or border.
Preserve reliable object hit areas and keyboard focus even when those areas
have no visible enclosure.

### Space carries meaning

Proximity indicates context; alignment supports comparison; explicit links
express relationships. Whitespace separates subjects and leaves room for
thought. A local alignment grid can help organize content without becoming a
visible page-wide grid or mandatory tiled layout.

Object placement remains stable while reading and selecting. Do not rearrange
content merely to make a selection look cinematic. Agent-requested layout
changes must remain understandable as changes to actual objects.

### Light directs attention

Use broad, restrained illumination to suggest depth and a small local emphasis
to identify attention. The content must remain readable with all atmospheric
effects disabled. Light is subordinate to text and meaningful media.

Selection, a related source, or a completed Agent change can receive temporary
emphasis. Ambient lighting does not imply processing, success, importance, or
evidence quality. Those meanings require an explicit interface state or label.

### Precision keeps the space usable

Typography has crisp edges, consistent roles, and deliberate alignment.
Relationship lines are fine and purposeful. Timing is calm and responsive.
The cinematic quality comes from composition, depth, and continuity.

Avoid ornamental HUD frames, targeting reticles, fake telemetry, scanning
lines, particle fields, perpetual pulses, and arbitrary coordinates. They add
visual activity without explaining the user's work.

## Spatial composition

The dashboard is one continuous field. Do not partition it into permanent
application regions. The separate controller remains the place for Agent
conversation and shared settings; it does not become an embedded dashboard
sidebar. Native window behavior remains available.

Use this visual order, from background to foreground:

1. A quiet continuous background and optional broad atmospheric light.
2. Contextual group labels and relationship lines.
3. Readable content objects.
4. Selection or Agent-change emphasis on the affected object.
5. Temporary controls, menus, and necessary interruption surfaces.

Groups primarily use proximity, shared alignment, and a concise label. A very
subtle regional tone may distinguish overlapping subjects when needed. Avoid
large outlined containers around every group. Membership must remain
inspectable when proximity alone is ambiguous.

Show relationships when they are the subject of the current view or relevant
to selection and inspection. Avoid an always-visible web of incidental lines.
Keep evidence references discoverable without requiring the user to find an
invisible connection. Lines must not cross readable text; direction and
relationship type need a clear cue when they carry meaning.

At dense scales, prioritize readable titles, useful grouping, and deliberate
inspection over shrinking everything into illegible miniature text. Do not
remove substantive content or change object positions as a decorative zoom
effect. Exact detail thresholds require later prototype validation.

## Content presentation

| Content | Default treatment | Information to preserve |
| --- | --- | --- |
| Idea or note | Direct text with a clear title and body hierarchy | Authored text and meaningful structure |
| Source | Source title, readable excerpt, restrained provenance | URL or origin and access to supporting material |
| Conclusion | Distinct heading with supporting text | Evidence references and their relationship to the conclusion |
| Group | Spatial association with a concise label | Membership and subject |
| Image or rich media | Media at its natural bounds with a caption when needed | Attribution, meaning, and necessary media controls |

A conclusion can be visually prominent when it is the focus of the work.
Do not enlarge every conclusion automatically or turn ordinary notes into
marketing headlines. Content hierarchy follows the task and authored meaning.
Avoid decorative text rotation and paper-like shadows as default object styling.

## Typography and color

Use a restrained sans-serif reading system with shared roles for focal titles,
object titles, body text, provenance, and controls. Reserve monospace for code
and actual identifiers. Chinese and Latin content must retain compatible
weight, spacing, and readable fallback fonts. Required fonts must work locally.

Large titles can be light in weight, but body text and metadata must remain
legible. Do not apply wide tracking to paragraphs, blur text for depth, or use
tiny uppercase labels as the default interface language. Long content wraps
predictably; truncation must have an accessible way to inspect the full value.

Use a quiet neutral field, clear foreground text, restrained secondary text,
and a small cool emphasis range. Dark presentation can suggest depth through
near-black cool neutrals; light presentation can suggest projection through
pale cool neutrals. Both preserve the same hierarchy and interaction meanings.
Dark mode alone does not define the design language.

Keep these color responsibilities distinct:

- Ambient field and illumination establish atmosphere.
- Content foreground and secondary foreground establish reading hierarchy.
- Focus, selection, and related-object emphasis establish interaction state.
- Success, warning, and failure communicate actual outcomes.
- Brand presentation follows the [bird mark rules](../assets/brand/README.md).

Do not assign a bright color to every object type. Source and conclusion labels
remain meaningful without color. Avoid text glow; illumination belongs behind
or around content and must not soften glyph edges.

## Interaction states

The current dashboard supports browsing, selection, pan, zoom, evidence
navigation, and the documented context commands. Agents own content mutations.
This language does not add manual editors, creation toolbars, or new commands.

| State | Presentation rule |
| --- | --- |
| Rest | Content and necessary provenance remain; temporary controls are absent. |
| Hover | A subtle local cue indicates the target without moving neighboring objects. |
| Keyboard focus | A clear, stable focus indicator remains visible independently of hover and selection. |
| Selection | Four short corner marks locate the object's bounds, with a restrained radial glow behind its content. Preserve text readability and object position. |
| Related content | Emphasize relevant evidence and links without making unrelated content unreadable. |
| Context action | Present supported actions near the target or through the existing controller; dismiss without leaving permanent chrome. |
| Agent change | Briefly identify affected objects and actual movement; settle back to readable content. |
| Failure or required input | Provide explicit, readable feedback with an actionable route through the appropriate surface. Do not encode it only as light. |

Hover is supplemental. Keyboard and pointer users must be able to reach
supported actions without relying on an undisclosed gesture or tiny target.
Menus restore focus when dismissed. Temporary presentation must not hide an
unresolved failure or a decision that still needs the user's attention.

### Selection geometry

Selected objects use four open corner marks with a small amount of soft light.
The shared default is an 18px arm and a 1px stroke in object coordinates; arms
shrink for small bounds and scale with the canvas. The center and most of every
edge remain open. A low-opacity radial glow fades out before the object's edges,
without a rectangular fill, text glow, blur filter, or pulsing animation.

`SelectionIndicator` in `@avesd/ui` owns the decorative treatment and its theme
tokens. Canvas objects and groups consume the same primitive. The indicator
never captures input, changes geometry, moves content, or replaces accessible
selection state. Related sources keep a restrained short-edge cue, not four
corners. Keyboard focus retains its independent visible outline, including when
the focused object is also selected. Deselecting removes both corners and glow;
reduced-motion mode keeps the same static treatment. In forced-colors mode,
the corners remain visible without relying on the glow.

An Agent's presence is primarily visible through understandable changes to the
work and its conversation in the controller. Avoid permanent avatars, activity
panels, and chat transcripts on the dashboard. Use existing operation and undo
contracts; visual feedback must not imply cancellation, reversal, or progress
that the underlying operation does not support.

## Motion and depth

Motion explains arrival, departure, a real position change, or a shift in
attention. It should preserve the viewer's ability to follow an object and
must not delay interaction. Keep camera movement intentional; do not pan,
zoom, or introduce parallax simply because the pointer moves.

Use one restrained timing family. Small feedback resolves quickly; meaningful
spatial changes may take longer so their destination remains understandable.
Exact durations and easing curves remain implementation calibration work.

Respect reduced-motion preferences with immediate placement and static
emphasis. Do not run ambient animation loops. Avoid heavy blur, layered
full-screen filters, and effects whose cost scales with every visible object.

## Necessary surfaces and accessibility

Content without boxes is the default, not a prohibition on functional surfaces.
Menus, the separate controller, permission prompts, and rich content that needs
its own background may use a bounded surface. Such surfaces need a clear
purpose, reliable contrast, restrained edges, and correct stacking.

Focused object details use square outer frames and continuous thin internal
boundaries, informed by Tips' layout and grid language. The frame owns the outer
edge, sections own horizontal boundaries, and grids own internal cell seams.
Adjacent regions share one line instead of stacking independent card borders.
Detail inspection uses an opaque readable surface, retains the field palette,
and returns to the unframed canvas when dismissed. The reusable contract lives
in [Framed detail layouts](../packages/ui/docs/layout-grid.md).

Atmospheric light must not lower text contrast. Selection and focus remain
distinguishable without color alone. Large invisible hit areas must not overlap
neighboring objects. Reading order and accessible names must remain meaningful
even though visual placement is spatial.

User-authored media and embedded content retain their own visual meaning;
do not recolor or blur them to fit the atmosphere. Core content must remain
usable offline and when optional effects or remote Agent capabilities are
unavailable. An unavailable remote capability does not make local content look
disabled.

## Implementation ownership and open calibration

`@avesd/ui` owns shared visual tokens and accessible primitives. The desktop
renderer owns spatial composition, domain-aware presentation, and selection
behavior. Keep geometry, persisted content, and service operations independent
of atmospheric effects. Legacy dashboard and plugin systems are not
dependencies of this visual direction.

Future implementation should consolidate semantic foreground, field,
illumination, emphasis, relationship, temporary-surface, typography, spacing,
and motion roles in the existing UI package. These are responsibilities, not a
new token API or a requirement to create more packages.

The following need validation on real content before being fixed as tokens:

- Exact palettes and light-field intensity in light and dark appearance.
- Font families, role sizes, line heights, and multilingual fallback metrics.
- Selection and keyboard-focus geometry, including overlapping content.
- Relationship visibility at different densities and zoom levels.
- Motion timing, effect budgets, and temporary control placement.

The approved direction is content without permanent chrome, light-field depth,
and precise readable presentation. Prototype wording, demonstration buttons,
sample positions, and particular gradients are not product requirements.

## Visual acceptance

Future UI changes should be reviewed with sparse and dense workspaces, long
notes, mixed Chinese and English text, multiple sources, and narrow windows.
Review light and dark appearance, keyboard operation, reduced motion, and
Agent changes as well as the resting frame.

A conforming result must satisfy these checks:

- At rest, the dashboard reads as content in space with no permanent app bars.
- Objects and groups remain understandable without a box around each one.
- Text stays crisp and readable without illumination or animation.
- Selection, focus, and evidence relationships are identifiable.
- Agent changes can be followed without a persistent activity dock.
- Dismissing a transient interaction restores the quiet composition.
- Necessary controls and unresolved failures remain accessible.
- The composition works with actual content rather than only short demo text.

Use the repository's visual QA workflow when implementing these rules.

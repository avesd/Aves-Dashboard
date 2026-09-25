# Canvas architecture

The canvas is Avesd's primary desktop view. It contains idea cards, URL source
cards with optional excerpts, conclusions with evidence snapshots, labeled
groups, and links in world coordinates. Each item stores versioned content
separately from its placement.
Older text cards and groups are normalized when read; saved canvas state uses
schema version 2. The viewport has independent pan and
zoom state, fits saved content when opened, and offers a Fit control. Canvas
objects are HTML elements so text remains editable; links
are SVG elements. CSS transitions provide movement and arrival
feedback. The interface respects the operating system's reduced-motion setting.
The renderer composes the canvas and Agent dock directly after workspace
navigation starts. Legacy plugin contributions initialize separately and do not
gate the canvas view or its operations.

The initial keyboard flow uses the canvas composer. Command/Ctrl+K focuses it.
Submitting text starts or continues an interactive Agent session. The Agent
inspects the canvas through `avesd_inspect_canvas` and changes it through
dedicated MCP tools. It does not receive direct file or persistence access.

Direct interaction supports adding ideas and groups, entering a source title,
URL, and excerpt, creating a conclusion from a selected card, dragging objects,
panning,
zooming, editing card content, Shift-clicking to link items or place a selected
card into a group, deleting a selected item, and undoing changes. Shift-clicking
another card while a conclusion is selected adds it as cited evidence. Evidence
keeps a title, URL, and excerpt snapshot if the original source is later changed
or removed. The same
operations are available to the Agent through tools. Both paths reach the
serialized `AgentWorkbench` canvas service in the Electron main process.

Canvas state is stored under the active dashboard's `viewState.canvas` key in
the existing versioned workspace snapshot. The runtime-neutral canvas model
validates coordinates, text, object references, revisions, and bounded undo
history. Writes are atomic and reject stale revisions. The existing widget and
plugin state is preserved in snapshots while its migration is planned; it is
not rendered in the primary canvas view.

Voice input, richer object types, scalable virtualization, and migration of
existing widgets are later work. The keyboard and future voice paths should
produce the same canvas operations.

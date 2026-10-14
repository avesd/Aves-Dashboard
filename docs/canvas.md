# Dashboard interaction and canvas architecture

The dashboard is Avesd's primary desktop view. Its canvas is the spatial rendering surface; internal canvas contracts and storage names remain stable. It contains idea cards, URL source
cards with optional excerpts, conclusions with evidence snapshots, labeled
groups, and links in world coordinates. Each item stores versioned content
separately from its placement.
Older text cards and groups are normalized when read; saved canvas state uses
schema version 2. The viewport has independent pan and
zoom state and fits saved content when opened. Canvas
objects are HTML elements for rich content display; links
are SVG elements. CSS transitions provide movement and arrival
feedback. The interface respects the operating system's reduced-motion setting.
Each canvas has an independent native window. A separate, always-on-top controller
starts collapsed at the screen edge and expands into Agent conversations, canvas
browsing, and shared settings. Command/Ctrl+K in a canvas opens the controller.
There is no target-canvas picker: the Agent discovers relevant canvases, reads
contents, and supplies explicit IDs to operations. Canvas windows do not contain
an embedded Agent dock or per-dashboard settings.

Interactive Agents use `avesd_canvases` for resource requests and
`avesd_open_canvas` to present a result. The service does not require a canvas to
be active or open. Legacy plugin runtime initialization is not part of the new
renderer startup. See [Canvas service](canvas-service.md) for contracts,
authorization, receipts, events, and desktop lifecycle.

The dashboard has no permanent toolbar, empty-state instructions, or manual
content creation and editing. People drag empty space to pan, scroll to zoom
around the pointer, and click items to select them. Evidence references can
select and center their source. Right-click offers only Show all and Ask agent;
Command/Ctrl+0 shows all content. Selection and viewport changes remain local
to the view and do not write shared content.

Agents create dashboards and own content mutations: adding, editing, moving,
grouping, linking, deleting, and undoing. The controller can open existing
dashboards but has no manual dashboard creation action. Agent operations reach
`CanvasService` and its serialized storage transaction in the Electron main
process. Updates appear in open views through service invalidations.

Canvas state is stored under the corresponding dashboard's `viewState.canvas` key in
the existing versioned workspace snapshot. The runtime-neutral canvas model
validates coordinates, text, object references, revisions, and bounded undo
history. Writes are atomic and reject stale revisions. The existing widget and
plugin state is preserved in snapshots while its migration is planned; it is
not rendered in the primary canvas view.

Voice input, richer object types, scalable virtualization, and migration of
existing widgets are later work. The keyboard and future voice paths should
produce the same canvas operations.

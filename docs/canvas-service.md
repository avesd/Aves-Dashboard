# Canvas service

The product calls each board a **dashboard**. Existing canvas API names and
storage contracts remain unchanged.

Avesd treats canvases as persistent resources and desktop windows as disposable
views. Interactive Agents discover canvases and explicitly address their targets;
window focus and legacy dashboard selection do not determine those targets.

## Resource and transport boundary

`CanvasService` has no Electron dependency. It uses the existing runtime-neutral
canvas validator and a storage adapter with a serialized transaction boundary.
The desktop main process hosts the service and its authenticated loopback HTTP
adapter. Trusted renderer requests reach the same service through typed preload
IPC; renderers receive neither bearer credentials nor filesystem access.

Canvas IDs reuse stable dashboard IDs. Storage retains existing dashboard
ownership and opaque view-state data, so this change does not move or discard
legacy widgets, sources, or plugin state. New canvases are created in the first
local workspace without changing selection. A single-instance desktop lock
prevents two application instances from writing the same local profile.

A summary contains `id`, `title`, `revision`, and `updatedAt`. The trusted
renderer's read also contains source/data block documents; the canvas MCP read
returns only block summaries. Renaming and source/layout block changes increment
the canvas revision. Data and saved view-state changes have independent revisions.
Existing legacy view-state remains stored alongside the new `blocks` array.
Strictly data-only render batches preserve the canvas revision. Mixed batches
that also change source, layout, or block metadata increment it once.


The controller can access all local canvases. A canvas renderer can access only
its assigned canvas and can request that the controller open. Interactive Agent
sessions receive their own client identity and all-local-canvas access. Widget
background sessions receive no Avesd MCP server or product tools. Their API
continues to enforce widget identity and the declared agent capability.

## Executable contract

[Shared schemas and types](../apps/desktop/src/shared/canvas/contracts.ts) define
requests, responses, events, and the preload interface. HTTP responses use
`{ok:true,value}` or `{ok:false,error:{code,message,currentRevision?}}`.

| Method and path | Request | Result |
| --- | --- | --- |
| `GET /v1/canvases` | Optional `query`, `cursor`, `limit` query parameters | Summaries and optional next cursor |
| `GET /v1/canvases/:id` | Canvas ID | Canvas read |
| `POST /v1/canvases` | `requestId`, `title` | Mutation receipt |
| `POST /v1/canvases/:id/rename` | `requestId`, `expectedRevision`, `title` | Mutation receipt |
| `GET /v1/requests/:requestId` | Request ID scoped to authenticated client | Receipt or null |
| `GET /v1/events` | Authenticated live connection | Server-sent invalidations |

All routes require a host-issued bearer credential. The listener binds
`127.0.0.1`, rejects browser Origin headers, bounds request bodies, and accepts
JSON for mutations. No unauthenticated token discovery endpoint is exposed.
The existing gateway address ends in `/invoke`; resolve `/v1/` against that
address for resource requests. `/invoke` remains the MCP relay transport.

List searches titles case-insensitively. Pagination orders by canvas ID and uses
the last ID as its cursor; it is not a catalog snapshot transaction. The default
page size is 50, capped at 100. Changes to several canvas resources are separate commits and can partially
complete. Block mutations are submitted through the authenticated MCP relay.

Errors distinguish invalid arguments (400), unauthenticated access (401),
forbidden operations (403), unavailable resources (404), revision conflicts and
reused request IDs (409), and unavailable storage (503). Unauthorized canvas IDs
are reported as unavailable rather than exposing whether they exist.

## Mutation receipts and events

The service checks permissions and revisions inside the storage transaction.
A committed receipt contains `requestId`, `canvasId`, `revision`, and
`committedAt`. The receipt, command fingerprint, and canvas mutation are written
in one atomic file replacement. Service metadata is stored under `canvasService`
in the workspace file but omitted from legacy snapshot reads; legacy saves
preserve the metadata rather than replacing it with renderer-supplied values.

An identical retry with the same client identity and request ID returns its
original receipt. Reusing that ID for different arguments fails. Receipts survive
application restart and currently have no automatic expiry. Desktop requests use
a stable local client identity; Agent identities follow their session lifetime.
Agent conversations themselves still do not resume after application exit.

On a timeout the caller may query the receipt or retry the identical command.
An absent receipt is not proof that the request failed: it may still be running.
After a revision conflict, reread and reconsider the edit before issuing a new
command. Canvas and Agent data are not logged by this service.

After successful persistence the service publishes `canvas.created`, `canvas.changed`, or `canvas.renamed` with the canvas ID, revision, and request ID.
Data-only renders still publish `canvas.changed`, carrying the unchanged canvas
revision; consumers use the event sequence to invalidate their reads.
The HTTP stream starts with `reset`; register a subscription before the initial
read. Events have a process epoch and stream sequence. They invalidate reads,
not replace them. Reconnect or a sequence gap requires rereading; no durable event
replay or exactly-once delivery is promised. Legacy mutations issue a reset.
Slow HTTP subscribers are disconnected to bound buffered output.

## Agent and desktop capabilities

Interactive sessions expose five `aves_dashboard_` tools, documented in
[Dashboard blocks](dashboard-blocks.md). `aves_dashboard_canvases` handles resource
requests, `aves_dashboard_open_canvas` presents windows, and the capabilities,
render, and inspect tools handle block creation and runtime observation. Legacy
workspace/widget tool dispatch remains removed.

The desktop preload has `views.inspect`, `list`, `open`, `focus`, `close`, and
`controller`. Opening an existing view focuses it. Closing a canvas view neither
deletes its contents nor cancels an Agent session. Window geometry, pan, zoom,
and selection are local view state and are not shared canvas mutations; viewport
state currently resets when a view reopens.

The controller starts as a 380 by 240 DIP voice controller at the bottom-right edge of the
current display's work area, with a 12 DIP inset. Expanding opens a 440 by 720 DIP
work panel, clamped to the available display. It stays above ordinary
windows and is configured to appear across macOS workspaces, including fullscreen
spaces. Startup and collapse use inactive display; explicit expansion activates
the window. Text input explicitly opens and focuses the composer. Hiding details
or closing the native window returns to compact mode without ending voice. Display removal and work-area changes reposition the toolbar.
Native fullscreen and multiple-display behavior still needs verification on
those configurations. Drag-to-edge placement and persisted window positions are
not implemented.

The controller includes dashboard browsing, independent conversations, and shared
Agent settings. Canvas windows provide the spatial field, sandboxed block documents, pan, zoom,
and a contextual menu; Command/Ctrl+K opens the controller. The controller has no target-canvas selector.

## Verification and future hosting

The previous synthetic canvas scenario and automated service tests have been
removed. `pnpm validate` checks lint, types, and the production build; it does
not establish live provider access. Resource operations, native block rendering,
data bindings, host actions, and source replacement need targeted verification.

The current service runs inside the desktop process. A future headless server can
reuse its contract and operation rules but needs its own process entry point,
authentication, authorization policy, and persistence adapter. Opening local
windows requires an attached desktop capability. Server hosting does not itself
provide offline synchronization, remote account support, or multi-user merging.

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
ownership and `viewState.canvas` data, so this change does not move or discard
legacy widgets, sources, or plugin state. New canvases are created in the first
local workspace without changing selection. A single-instance desktop lock
prevents two application instances from writing the same local profile.

A summary contains `id`, `title`, `revision`, and `updatedAt` (null for an existing
canvas with no service mutation timestamp). A read adds `schemaVersion`, `items`,
`links`, and `canUndo`. Undo snapshots remain private. Renaming increments the
canvas revision; undo creates another revision and restores content, not titles.

The controller can access all local canvases. A canvas renderer can access only
its assigned canvas and can request that the controller open. Interactive Agent
sessions receive their own client identity and all-local-canvas access. Legacy
widget sessions retain their original active-scope and capability checks; they
are not given the new controller tools or HTTP resource adapter.

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
| `POST /v1/canvases/:id/commands` | `requestId`, `expectedRevision`, `operations` | Mutation receipt |
| `GET /v1/requests/:requestId` | Request ID scoped to authenticated client | Receipt or null |
| `GET /v1/events` | Authenticated live connection | Server-sent invalidations |

All routes require a host-issued bearer credential. The listener binds
`127.0.0.1`, rejects browser Origin headers, bounds request bodies, and accepts
JSON for mutations. No unauthenticated token discovery endpoint is exposed.
The existing gateway address ends in `/invoke`; resolve `/v1/` against that
address for resource requests. `/invoke` remains the MCP relay transport.

List searches titles case-insensitively. Pagination orders by canvas ID and uses
the last ID as its cursor; it is not a catalog snapshot transaction. The default
page size is 50, capped at 100. Apply accepts up to 50 existing canvas operations.
Batches are atomic within one canvas. Changes to several canvases are separate
commits and can partially complete.

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

After successful persistence the service publishes `canvas.created`,
`canvas.changed`, or `canvas.renamed` with the canvas ID, revision, and request ID.
The HTTP stream starts with `reset`; register a subscription before the initial
read. Events have a process epoch and stream sequence. They invalidate reads,
not replace them. Reconnect or a sequence gap requires rereading; no durable event
replay or exactly-once delivery is promised. Legacy mutations issue a reset.
Slow HTTP subscribers are disconnected to bound buffered output.

## Agent and desktop capabilities

Interactive sessions expose `avesd_canvases` with a `request` containing one of
`list`, `read`, `create`, `rename`, `apply`, or `receipt`. Its schema and description
explain explicit targets, operation shapes, revisions, and retry behavior.
`avesd_open_canvas` presents a result in a native window. Legacy plugin tools
remain on the separate legacy toolset.

The desktop preload has `views.inspect`, `list`, `open`, `focus`, `close`, and
`controller`. Opening an existing view focuses it. Closing a canvas view neither
deletes its contents nor cancels an Agent session. Window geometry, pan, zoom,
and selection are local view state and are not shared canvas mutations; viewport
state currently resets when a view reopens.

The controller starts as a 204 by 48 DIP toolbar at the bottom-right edge of the
current display's work area, with a 12 DIP inset. Expanding opens a 420 by 640 DIP
conversation panel, clamped to the available display. It stays above ordinary
windows and is configured to appear across macOS workspaces, including fullscreen
spaces. Startup and collapse use inactive display; explicit expansion focuses
the composer. Display removal and work-area changes reposition the toolbar.
Native fullscreen and multiple-display behavior still needs verification on
those configurations. Drag-to-edge placement and persisted window positions are
not implemented.

The controller includes dashboard browsing, independent conversations, and shared
Agent settings. Dashboard windows provide read-only navigation and selection; Command/Ctrl+K
opens the controller. The controller has no target-canvas selector.

## Verification and future hosting

`pnpm test` covers service persistence, atomic batches, stale revisions, denied
access, duplicate requests, receipt recovery, authenticated HTTP, events, and
renderer editing. After `pnpm build`, run
`pnpm --filter @avesd/desktop test:electron canvas` for the isolated native scenario.
It uses temporary synthetic data and a synthetic ACP provider. Set
`AVESD_CANVAS_SCREENSHOTS` to a temporary directory to capture its UI states.

The current service runs inside the desktop process. A future headless server can
reuse its contract and operation rules but needs its own process entry point,
authentication, authorization policy, and persistence adapter. Opening local
windows requires an attached desktop capability. Server hosting does not itself
provide offline synchronization, remote account support, or multi-user merging.

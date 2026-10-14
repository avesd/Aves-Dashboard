# Canvas service and desktop window design

Status: Historical proposal. The initial local version is implemented; see
[current service documentation](../../docs/canvas-service.md) for shipped behavior
and limitations. The design and baseline below record the original proposal and
do not replace current architecture documentation.

Avesd will expose independently addressable canvases through an application
service. A minimal controller hosts Agent conversations, while each canvas opens
in its own window. The Agent discovers relevant canvases and chooses its targets
without requiring the user to select a target before speaking.

## Agreed direction

- A canvas exists independently of its window. Closing a view neither deletes
  the canvas nor cancels an Agent task.
- The controller can collapse into a subtle screen-edge toolbar. Shared settings
  belong at the application level rather than on every canvas.
- Agents select targets from conversation context and authorized canvas reads.
  They ask the user when intent remains ambiguous. Window focus is a hint, not
  an implicit mutation target or a permission grant.
- Human and Agent edits use the same validated application operations.
- Core canvas workflows run locally without accounts or network connectivity.
  A future server can host the application service without hosting Electron.
- Desktop presentation and persistent content are separate capabilities.

## Implementation baseline at proposal time

The [canvas model](../../packages/workspace-model/src/canvas.ts) already validates
operations, rejects stale revisions, and retains bounded undo history. Canvas
state currently lives in a dashboard's `viewState.canvas`; see
[Canvas architecture](../../docs/canvas.md).

[AgentWorkbench](../../apps/desktop/src/main/workspace/agent-workbench.ts) serializes
writes, but both canvas reads and writes require the requested dashboard to match
the selected dashboard. Tool invocation also checks the session's originating
scope against the active scope. These checks currently protect against accidental
retargeting and must be replaced by explicit resource authorization, not removed
without replacement.

The [Agent gateway](../../apps/desktop/src/main/agent/agent-gateway.ts) already
provides a bearer-authenticated HTTP endpoint on loopback. The
[MCP relay](../../apps/desktop/src/main/agent/workspace-mcp.ts) forwards tool calls
to it. This is a useful transport starting point, but its generic `/invoke`
endpoint is not yet an independent canvas service contract.

[Desktop composition](../../apps/desktop/src/main/desktop-application.ts) binds
notifications, some IPC authorization, and native surfaces to one `mainWindow`.
[Agent sessions](../../docs/agent-sessions.md) retain an originating dashboard;
conversations currently live in memory until application exit.

## Resource model

| Resource | Identity and lifetime | Responsibility |
| --- | --- | --- |
| Canvas | Stable opaque `canvasId`; persists without an open window | Title, objects, links, revision, and undo history |
| Canvas object | `itemId` unique within its canvas | Existing typed content and placement |
| Agent session | `sessionId`; independent of window focus | Conversation, task state, and host-granted access |
| Desktop view | Local `viewId`; disposable | Association with a canvas, window bounds, pan, zoom, and selection |

Canvas summaries expose `id`, `title`, `revision`, and `updatedAt`. A full read
adds `schemaVersion`, `items`, and `links`; internal undo snapshots are not part
of the default response. Title and content mutations share a monotonically
increasing canvas revision. Undo changes content through a new revision, never
by rolling the revision counter back.

New canvases receive opaque IDs from the service. During migration a private
mapping resolves each canvas ID to its existing workspace/dashboard record.
The public contract must not require clients to select a workspace or know how
canvas state is stored. Legacy workspace ownership remains available internally
for compatibility and authorization; this proposal does not delete it.

Window geometry and viewport preferences stay local to the desktop view. They
must not increment the shared content revision or become dependencies of server
execution. The first desktop version reuses an existing window when opening an
already open canvas; supporting multiple views of one canvas is deferred.

## Service boundary

```text
Controller renderer     Canvas renderer
         |                    |
         +--- typed preload --+
                    |
              Desktop host                 Agent MCP tools
                    |                            |
                    +--- application client -----+
                                  |
                         Canvas application service
                                  |
                         Domain and persistence

Desktop presentation operations terminate at the desktop host.
```

Keep the application service independent of Electron and transport. Initially it
can run inside the desktop main process, with a local HTTP adapter for external
clients and MCP. Trusted IPC handlers can call the same service directly.
Extraction to a separate local process is not required for the first version.
Only one service instance may own writes to a given local store.

Renderers continue to use narrow typed preload APIs. They receive neither the
service bearer credential nor direct filesystem or privileged network access.
The service authenticates clients and derives actor identity and allowed canvas
access from trusted context, never from a caller-supplied `actorId`.

Interactive controller sessions can discover the local canvases allowed by the
host. Legacy widget sessions keep their existing narrower access; introducing
multi-canvas controller sessions must not widen widget permissions. Authorization
is rechecked when an operation executes, including queued work.

## Proposed version one methods

Method names below define application semantics. HTTP and MCP are adapters to
these methods and must not implement separate mutation rules.

| Method | Input | Result |
| --- | --- | --- |
| `canvases.list` | Optional text query, cursor, and bounded limit | Authorized summaries and optional next cursor |
| `canvases.read` | `canvasId` | Current canvas snapshot |
| `canvases.create` | `requestId`, title | New canvas summary and mutation receipt |
| `canvases.rename` | `requestId`, `canvasId`, `expectedRevision`, title | Updated summary and receipt |
| `canvases.apply` | `requestId`, `canvasId`, `expectedRevision`, operations | Committed revision and receipt |
| `requests.read` | `requestId` | Recorded outcome for the authenticated client, if present |
| `events.subscribe` | Catalog and/or authorized canvas subscriptions | Invalidation events and subscription acknowledgement |

Start with title search for `canvases.list`; the Agent reads candidate canvases
when titles are insufficient. Full-text indexing and generated semantic summaries
are deferred. A zero-match query does not by itself authorize creating a canvas;
the Agent still follows the user's intent.

`canvases.apply` reuses the existing typed object operations, including undo.
Each batch targets exactly one canvas and commits atomically. Operations spanning
several canvases are separate commits, with partial completion reported honestly.
Cross-canvas transactions and automatic rollback are outside version one.
Canvas deletion is deferred until its recovery behavior is designed; closing a
desktop view is available independently.

An illustrative command using synthetic identifiers:

```json
{
  "requestId": "request-example-1",
  "canvasId": "canvas-example-1",
  "expectedRevision": 7,
  "operations": [
    { "type": "move", "id": "item-example-1", "x": 120, "y": 80 }
  ]
}
```

The corresponding receipt identifies `requestId`, `canvasId`, the committed
revision, and commit time. A caller needing updated contents performs a read;
the command response need not resend the complete canvas.

## Consistency and failure behavior

The service checks authorization and validates the complete command before
committing. Revision comparison occurs inside the write transaction. A stale
revision produces `REVISION_CONFLICT` with the authorized current revision; the
caller rereads and reassesses its change instead of blindly retrying with a newer
revision. Invalid or stale commands have no partial effects.

Mutation request IDs are scoped to an authenticated client identity stable for
that client's retry lifetime. The service records the command fingerprint and
outcome atomically with the mutation. An identical retry returns the recorded
outcome, even after restart; the same ID with different arguments fails with
`REQUEST_ID_REUSED`. Concurrent duplicates must share one outcome. Authorization
is still checked before returning a stored result.

For the initial implementation, retain committed mutation receipts without
automatic expiry. Retention and compaction require a separately specified retry
window before receipts can be pruned. Receipts need a fingerprint and result,
not an extra copy of sensitive canvas contents. The existing atomic snapshot save
does not by itself implement this contract; receipt storage must participate in
the same commit.

A disconnected or timed-out caller treats the outcome as unknown. It can query
the receipt or retry the identical command with the same ID. An absent receipt
does not prove failure because the request may still be executing. Creating a
fresh ID after a timeout can duplicate effects and is not a recovery strategy.

Use a stable error envelope with `code`, a safe `message`, and optional typed
details. Initial codes cover `INVALID_ARGUMENT`, `UNAUTHENTICATED`, `FORBIDDEN`,
`NOT_FOUND`, `REVISION_CONFLICT`, `REQUEST_ID_REUSED`, and `UNAVAILABLE`.
Do not expose unauthorized resource existence or private content through errors.

## Events and desktop presentation

Publish `canvas.created`, `canvas.changed`, and `canvas.renamed` only after
persistence succeeds. Events carry canvas ID, revision, and request ID where
applicable, without duplicating document bodies. Catalog subscribers receive
authorized metadata invalidations; canvas subscribers reread the relevant canvas.

Version one uses live invalidations rather than a durable event history. On
initial subscription, register delivery before acknowledging it; the client then
reads its initial state while buffering invalidations. If a buffered revision is
newer than the read, reread. Events carry a stream epoch and per-subscription
sequence so clients can detect gaps. On a gap, reconnect, or service restart,
resubscribe and reread. Duplicate events are harmless; event delivery does not
promise exactly-once processing.

Desktop methods are separate: `views.open(canvasId)`, `views.focus(viewId)`,
`views.close(viewId)`, and `views.list()`. Opening a canvas does not alter its
content. Closing a view leaves the canvas and Agent task intact. The host checks
that the caller may present the requested canvas. These methods are available
only when a desktop host is attached; a headless service reports the capability
as unavailable rather than pretending a window was opened.

For example, the Agent can discover two relevant canvases, read both, edit each
with explicit IDs, and then open one result for the user. Switching focus during
that sequence changes neither the pending targets nor their authorization.

## Transport and future server hosting

Propose versioned HTTP JSON endpoints under `/v1`, with server-sent events for
live invalidations. Candidate routes are `GET /v1/canvases`,
`GET /v1/canvases/:id`, `POST /v1/canvases`,
`POST /v1/canvases/:id/rename`, `POST /v1/canvases/:id/commands`,
`GET /v1/requests/:requestId`, and `GET /v1/events`.
Exact schemas and status-code mappings belong in executable contracts when
implementation begins. Protocol version and stored canvas schema version are
distinct. Desktop operations are not part of these headless resource routes.

The local adapter binds loopback and requires host-managed authentication. Keep
origin checks and request bounds from the existing gateway. Do not log tokens,
canvas contents, or full tool arguments. Adapter validation and service-level
authorization apply even when the caller is local.

A remote deployment can reuse domain rules and application contracts, but needs
its own authentication, access policy, transport security, and persistence adapter.
Remote execution also needs an explicitly attached desktop capability to open
local windows. Hosting the service remotely does not automatically provide
offline synchronization or conflict merging; those are separate future designs.

## Implementation sequence and acceptance

1. Extract canvas service methods and executable contracts. Resolve IDs without
   reading global selection and preserve the existing operation validator and
   serialized storage path. Keep legacy snapshots and widget authorization intact.
2. Add atomic receipts and authenticated adapters. Verify stale writes, concurrent
   duplicate requests, unknown outcomes, restart recovery, and denied resource
   access through the same service boundary.
3. Add discovery tools and session permissions independent of active dashboards.
   Verify an Agent can read and modify an authorized closed canvas while changing
   focus cannot redirect its command. Preserve legacy widget restrictions.
4. Add desktop view registration, per-view IPC checks, and event subscriptions.
   Verify two canvas windows update independently, reconnection rereads state,
   and closing a view does not cancel work or delete content.
5. Replace the current shell with pure canvas windows and a collapsible controller.
   Visually verify focus, screen edges, multiple displays, and fullscreen behavior
   using the repository UI verification workflow.

Before shipping, test the core canvas workflow offline without an account and
update the current architecture documentation to describe the implemented
contract. Network-dependent Agent providers retain their own connectivity
requirements. Pure local canvas editing must remain usable without them.

Physical storage migration, separate-process hosting, remote deployment,
multi-user synchronization, and additional plugin features are deferred. They
are not prerequisites for the controller and independent canvas windows.

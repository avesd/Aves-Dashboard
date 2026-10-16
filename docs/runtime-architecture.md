# Runtime architecture

The current canvas and controller architecture is described in
[Canvas service](canvas-service.md) and [Canvas architecture](canvas.md).
Dashboard navigation, widget hosting, and sidebar sections below document retained
legacy infrastructure; they are not the startup UI of the current desktop.

> This document describes the retained dashboard and plugin infrastructure.
> The primary desktop view and Agent dock are composed directly. Legacy plugin
> contributions initialize after that view renders to support historical widget
> definitions and tools. See [Canvas architecture](canvas.md) for the current
> interaction and persistence path.

## Plugin and process boundaries

Avesd keeps a small trusted Electron host. Its retained plugin runtime uses
upstream Cordis, hidden behind
`@avesd/plugin-api`, so public plugins do not depend on the runtime framework.
Plugin registrations are reversible effects: activating a new version adds its
contributions first, then disposes the previous version in reverse registration
order. Failed activation removes only the candidate's effects, leaving the
previous version active.

Plugins interact with the host through two explicit surfaces on their activation
context. `contributions` publishes typed widget and data-source extension
points, while `services` contains only the storage, command, or external-opening
capabilities declared by the plugin and authorized by the host. The kernel binds
service scopes to the plugin identifier before activation, so plugin code cannot
select another plugin's service namespace. Concrete persistence and privileged
desktop implementations remain outside the runtime-neutral public API.

Renderer widgets use the framework-neutral `@avesd/plugin-ui` contract. The host
provides an unstyled Shadow DOM root and scoped context, calls the returned
controller when configuration or size changes, and disposes it on removal or
plugin replacement. Widget configuration is versioned JSON with optional schema
metadata for future settings UI and Agent tooling. React is an implementation
choice of an individual widget rather than part of the public widget API.

The old widget definitions remain available to compatibility tools while their
saved instances await migration to the canvas.

## Workspace ownership and persistence

Product data has a separate scope hierarchy. A workspace owns dashboards and
shared data sources; a dashboard owns its widget instances, private data
sources, and view state. Deleting a dashboard removes its widgets and private
sources without deleting shared workspace data. Widget instances own their
input bindings, and binding transactions reject invisible or type-incompatible
sources. Repository operations carry an explicit workspace scope, while the
kernel-injected plugin identifier remains an orthogonal security namespace.

The desktop persists a versioned workspace snapshot in its configured data
directory, Electron's user-data directory by default. Renderer code reaches it
only through a typed preload API. A shared runtime-neutral validator checks JSON
fields, unique entity IDs, workspace/dashboard ownership, stored-source binding
visibility, and non-overlapping grid placements before a snapshot is accepted.
Temporary or plugin-provided binding identifiers remain resolvable by the live
data service without persisting their values or requiring an installed plugin.

The main process rejects invalid snapshots before writing a private temporary
file and atomically renaming it. The runtime-neutral repository remains usable
with memory-only or alternative persistence drivers. See
[Application configuration](application-configuration.md) for selecting and
migrating the data directory.

Each dashboard uses a host-owned 24-column logical grid with unbounded rows.
Plugins declare an initial widget size. Each instance can be resized independently
in single-cell increments (at least 1 × 1), up to the remaining grid width. The
host records the contributing plugin identity and validates every placement.
Resize previews reach widget controllers immediately; releasing the handle commits
the instance placement, which survives restart. Arrow keys resize one axis at a time.
Manual controls and Agents share one transactional layout service, so invalid,
overlapping, out-of-bounds, or stale layout batches are rejected before storage.

The grid is an invisible layout boundary in normal use: widget plugins render
their entire assigned region without host-provided cards, borders, headers, or
padding. Grid guides and layout controls appear only while editing.

## Workspace navigation

A narrow vertical sidebar provides **Workspaces**, **Agent**, **Unlock dashboard
/ Lock dashboard**, and **Settings** controls using Lucide icons. The workspace
panel renders every workspace and its dashboards as a collapsible tree. The
current dashboard is highlighted; choosing another dashboard switches through
the same atomic navigation transaction and closes the panel. Agent, workspace,
and settings panels are mutually exclusive and open beside the sidebar.

Settings lets the user place the sidebar on the left or right; this preference
is saved locally for all workspaces. Unlocking closes the panel and enables
moving, resizing, and removing existing widgets. Creation and configuration go
through the Agent; there is no widget picker or layout settings toolbar. Lock
the dashboard from the sidebar when finished. Command/Ctrl+E and the dashboard
context menu remain available.

Widgets can also own workspace and dashboard navigation UI. Widget
contributions and local manifests declare `catalog`, `navigation`, and
`management` capabilities, and the host supplies only the declared services:

- `context.catalog.listWorkspaces()` returns `{id, name}[]`.
- `context.catalog.listDashboards(workspaceId)` returns
  `{id, name, workspaceId}[]` for that workspace without switching or reading
  its contents.
- `context.navigation.getCurrent()` returns the active workspace/dashboard pair;
  `select(scope)` requests a switch.
- Both read services expose `subscribe(listener)` as invalidation notifications.
  Consumers requery; subscriptions are released when the widget is disposed.
- `context.management.execute(command)` creates, renames, or deletes a dashboard
  or workspace. The widget SDK defines the typed command shapes.

These are projections and commands over the local repository, not ordinary
mutable business data sources. No layout, widget configuration, or source value
is included in directory responses. Widget mounting IDs remain fixed throughout
that widget's lifetime, independently of the current selection. The main process
checks declared capabilities and active instance ownership inside its transaction
queue. Local widgets have a separate narrow preload bridge authenticated by
their native view, with no access to the desktop renderer's host API.

Creating a workspace creates its first dashboard and selects the new scope.
Deleting a dashboard removes its widgets and private sources while retaining
shared workspace data; deleting a workspace removes all owned content. The last
workspace and each workspace's last dashboard are protected. Widgets own the
interaction and any deletion confirmation.

Selection is an optional field in the version 1 workspace snapshot. Existing
snapshots retain their IDs and contents. The host bootstraps an existing or new
local dashboard when selection is absent. Management, navigation, and workspace
writes share one transaction queue; failed saves leave selection unchanged.
Deleting the active scope selects a remaining scope in the same transaction.

Switching unmounts old widgets, destroys their native browsers, and starts a
fresh Agent conversation on the next connection. Temporary widget and web state
resets; layouts, configuration, bindings, and persisted data remain. Old Agent
credentials and queued widget calls are rejected. Tests and previews receive
their own synthetic in-memory workspace and never modify the user's workspace.
Preview navigation changes synthetic selection without closing the preview, so
tests can inspect the result; live navigation disposes the originating widget.

The renderer welcome screen is the first built-in UI plugin and participates in
Vite hot module replacement. Local single-module widget plugins can also be
authored, tested, and installed through the Agent tools described in
[Local widgets](local-widgets.md). General third-party packages, dependency
installation, and TypeScript compilation for user plugins are not implemented.

## Agent integration

The conversation renders streamed Markdown replies, including code blocks,
lists, and tables. Raw HTML and unsafe links are disabled, and remote images
are represented by their labels without fetching them. Backend-provided
reasoning appears in collapsed disclosures. Tool calls remain in the timeline
with incremental status, input, and output; unfinished calls are marked
interrupted when the turn ends or the connection fails. New output follows the
scroll position only while the user is near the bottom. These details are
session-local and are cleared on provider/session reset.

The desktop Agent uses a main-process DeepSeek tool loop through typed IPC.
Credentials are loaded from local environment files and never exposed to the
renderer. Model choices are configured locally; Check access sends a short
request.

Interactive sessions receive five validated canvas tools for resource operations,
presentation, capabilities, block submission and inspection. Background widget
sessions receive no product tools. Tool invocations capture the current execution's
revocable authorization; the canvas service rechecks it at transaction admission.
The authenticated local-host HTTP gateway and standalone MCP relay remain
independent interfaces. Neither gateway availability nor API configuration
prevents local canvas use.

See [Agent sessions](agent-sessions.md) for configuration, cancellation,
supplement queues, question continuations, and execution authorization.

# Local widgets

## Compatibility boundary

The earlier widget runtime, installed-plugin storage, and sandboxed host APIs
remain for compatibility. Agents now receive only the canvas tools described in
[Canvas service](canvas-service.md). Widget composition, plugin authoring,
data-source management, and shared-resource grants are no longer Agent tools.
There is currently no Agent-driven draft, test, preview, or activation workflow.

An installed plugin contributes reusable widget types to the legacy catalog.
A legacy dashboard contains instances with layout, configuration, bindings, and
local context. Existing instances and persisted source retain their identities.

The retained local format contains a manifest, a JavaScript ES module, and
declarative interaction steps. The module exports `mount(root, { signal })` and
returns `update({ configuration, size })` and `dispose()` methods. Source is
limited to 64 KiB. The host passes the instance grid size to `update`; changing
manifest defaults affects new instances only. Unstored widget state resets when
its instance is recreated or the app restarts.

Local code never executes in the main process or trusted renderer. Live widgets
use separate in-memory Electron sessions, sandboxing and context isolation,
no Node access, narrow typed preload APIs, a restrictive CSP, and guarded
navigation. Host-mediated capabilities expose workspace metadata, private
storage, explicitly shared resources, and declared browser services. At most
eight live local widgets can be displayed; opening one has a five-second deadline.

## Private plugin storage

Declare `files` and/or `sqlite` in the manifest's `capabilities`. The host
derives workspace and plugin identity from the authenticated live widget;
callers cannot choose another scope. Instances of the same plugin in one
workspace share storage. Different workspaces and plugins have separate
namespaces. Every call, including calls through an existing database facade,
rechecks the active widget and manifest.

```js
await context.files.write("notes/state.json", JSON.stringify({ count: 1 }));
const state = JSON.parse(await context.files.readText("notes/state.json"));
await context.files.write("assets/sample.bin", new Uint8Array([1, 2, 3]));
const bytes = await context.files.read("assets/sample.bin");
const entries = await context.files.list("notes"); // {name, kind}[]
await context.files.remove("assets/sample.bin");

const db = await context.sqlite.open("tasks.sqlite");
await db.execute("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT)");
await db.transaction([
  { sql: "INSERT INTO tasks (title) VALUES (?)", parameters: ["Read"] },
  { sql: "INSERT INTO tasks (title) VALUES (?)", parameters: ["Write"] },
]);
const tasks = await db.query(
  "SELECT id, title FROM tasks WHERE id > ? ORDER BY id LIMIT 20",
  [0],
);
```

Private content lives under the configured data directory in
`plugin-storage-v1/<workspace-hash>/<plugin-hash>/{files,sqlite}/`, outside the
workspace JSON snapshot and Agent inspection responses. Relative file paths use
ASCII letters, digits, spaces, `_`, `-`, and `.`; absolute paths, empty
components, traversal, symlinks, and hardlinks are rejected. File writes
atomically replace one file and create parent directories. Files and databases
use separate namespaces, so file operations cannot overwrite SQLite databases
or journals.

Storage is retained when widget instances are removed. Automatic orphan cleanup
and migration of existing JSON data sources are not yet implemented; back up the
full configured data directory to include private data.

SQLite executes in a host-owned child process with a two-second deadline.
Queries execute on read-only connections after host-only journal recovery.
Parameterized mutations and batches use transactions; a failed batch rolls
back. SQLite authorization denies `ATTACH`, `DETACH`, `PRAGMA`, extension
loading, virtual tables, and plugin-controlled transactions. Each entry accepts
one SQL statement.

Parameters support null, string, finite number, signed int64 bigint, and
Uint8Array; integers beyond JavaScript's safe range return as bigint. Errors do
not return SQL text, data values, or host paths. Initial limits are:

- 4 MiB per file operation.
- 1000 directory entries.
- 16 KiB SQL per statement.
- 128 parameters per statement.
- 64 statements per transaction.
- 1000 rows and 4 MiB per query response.
- 4 MiB per SQL parameter set or batch.
- 32 MiB of SQLite heap.
- 8192 pages per database.

These are per-operation and per-database limits, not an aggregate disk quota.
Use pagination for queries. A connection closes after each request; database
facades carry no filesystem path or unrestricted connection. This isolates
plugin calls, not hostile local OS processes that can modify the application's
private storage directory.

Tests and previews get fresh temporary private storage, never live files or
databases. It is removed after the preview or test closes and pending work ends.

## Shared resources and cross-plugin grants

Declare `resources` to publish or consume explicitly shared resources inside the
current workspace. Publishing also requires `files` or `sqlite` for the chosen
kind. A resource exposes exactly one existing private file or database; the
host-owned directory maps an opaque resource ID to its source. Publishing does
not copy or move bytes, expose the publisher's storage root, or share sibling
files. The source remains available through the publisher's private storage API.
Removing a widget does not delete its publication, grants, or source data.

```js
// Producer: capabilities ["files", "sqlite", "resources"].
const db = await context.sqlite.open("tasks.sqlite");
await db.execute("CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, title TEXT)");
const published = await context.resources.publish({
  key: "tasks",
  name: "Tasks",
  kind: "sqlite",
  path: "tasks.sqlite",
  contract: {
    id: "example.tasks",
    version: 1,
    schema: {
      tables: { tasks: { columns: { id: "integer", title: "text" } } },
    },
  },
});

// Consumer: capabilities ["resources"]. Discovery itself grants no access.
const candidates = await context.resources.list({
  kind: "sqlite",
  contractId: "example.tasks",
  version: 1,
});

// After the user chooses a resource and authorizes this plugin through the Agent:
const chosen = candidates.find((resource) => resource.access !== "none");
if (chosen) {
  const shared = await context.resources.openDatabase(chosen.id);
  const tasks = await shared.query(
    "SELECT id, title FROM tasks ORDER BY id LIMIT 20",
  );
}
```

The directory returns only published ID, key, name, kind, publisher plugin ID,
contract, and the caller's `none`/`read`/`read-write` access. No source paths,
file contents, SQL rows, or other recipients are returned to plugins. Names and
schema are intentionally published metadata; never place secrets or private
records in them. Contract ID and version filters match exactly. Schemas are
descriptive, not runtime validators, migration programs, or certification that
the source actually conforms. Consumers must handle incompatible data
explicitly.

Shared-resource grants remain trusted host state. Plugins cannot grant access
to themselves or others. Existing grants continue to be enforced, but the Agent
grant tools have been removed and there is no settings panel for creating new
grants. Grants apply to all instances of the recipient plugin in the workspace,
including other dashboards; they do not grant private storage capabilities or
cross-workspace access.

Publications are immutable. Repeating an identical publication with the same
key in the same workspace/plugin returns its existing ID. Changing its source,
kind, name, or contract requires publisher-only `unpublish(id)` followed by a
new publish. Unpublishing removes grants and invalidates old facades without
deleting source bytes. A new publication gets a new ID and inherits no grants.

The host saves metadata, internal locators, and grants atomically in
`shared-resources-v1.json` under the configured data directory, separate from
the renderer-owned workspace snapshot. It survives restart and must be included
with private storage in backups. Corrupt metadata fails closed; failed saves do
not change access. Current limits are 4096 publications, 256 grants per resource,
and 16 KiB/16 levels per schema. Orphan cleanup and publisher ownership transfer
are not yet implemented. Tests and previews use their own temporary directory
and can never discover or grant access to live resources.

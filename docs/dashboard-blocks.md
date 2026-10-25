# Agent-authored dashboard blocks

A block is independently authored HTML/CSS/SVG placed in canvas world
coordinates. Each canvas renders its blocks inside one shared sandbox document,
with one Shadow DOM root per block. Optional JavaScript controls its presentation and interaction.
There are no fixed business component types, package imports, dependency
installation, or plugin activation steps. The local renderer and saved content
work without an account or network connection.

## Agent tools

Interactive sessions receive exactly five tools:

| Tool | Input | Result |
| --- | --- | --- |
| `aves_dashboard_canvases` | `request` with `list`, `read`, `create`, `rename`, or `receipt` | Canvas metadata, block summaries, or mutation receipt |
| `aves_dashboard_open_canvas` | `canvasId` | Opened/focused window identity |
| `aves_dashboard_capabilities` | `canvasId`, optional `kind` (`data`, `actions`, `all`) and `capabilityId` | Allowed sources, fields, actions, parameter descriptions, and bridge contract |
| `aves_dashboard_render_blocks` | `canvasId`, `requestId`, `expectedRevision`, `changes` | Saved mutation receipt and per-block runtime status |
| `aves_dashboard_inspect_blocks` | `canvasId`, optional `blockIds` and `include` | Selected source, snapshots, action bindings/status, layout, rendering errors, and optional real PNGs |

Canvas reads expose summaries, not full block source or values. Inspection
`include` accepts `source`, `data`, `actions`, `layout`, `screenshot`, and `errors`.
A rendering receipt confirms persistence, not visual correctness. Open the
canvas and inspect its actual output. Unopened canvases report `unmounted`;
loading, ready, and failed documents report separate runtime states. Saved
source revision and displayed revision are reported independently.

## Source and changes

Create requires a stable block `id`, `source: {html, css?, js?}`, and
`bounds: {x, y, width, height}`. Optional fields are `description`, `data`,
`bindings`, and `actions`. An optional `question` declares answer semantics for a freely
authored question document. HTML is a fragment; CSS and JavaScript are inline
source. Updates replace only supplied top-level fields. A supplied `source`
replaces the full document; omitted CSS or JavaScript becomes empty, so include
the complete source when repairing a document. Moves replace bounds. Removal
releases the displayed document and subscription. It does not cancel an
already-started Agent task.

Changes in one canvas are persisted atomically. The expected canvas revision
protects source, layout, binding, and action changes. An identical retry with
the same caller/request ID returns the original receipt. A reused ID with
different arguments or a stale canvas revision is rejected. The older
`avesd_` tool names are not aliases.

Each newly created block has a distinct generation identity. Removing and
recreating the same ID cannot reuse the previous document's lease. Source
updates increment the source revision and preserve data and saved view state.
A replacement document loads before becoming visible; a failed update leaves
the previous display in place, with its older displayed revision identified.
That older document cannot continue invoking actions after replacement.
Superseded failed candidates release their host leases before another version
mounts. A rejected mount can retry the same saved source version on a later
synchronization.

There are at most 64 blocks per canvas and 50 changes per mutation. Bounds use
world coordinates with widths from 40–4000 and heights from 30–4000. Source
fields and JSON data are bounded. Data and view-state objects are limited to
32 KiB and 16 levels. New source versions preserve state only when the generated
code explicitly saves and restores it through the bridge.

## Runtime bridge and live data

The generated document receives only `window.avesBlock`:

- `onData(callback)` subscribes to snapshots and returns an unsubscribe function.
- `getSnapshot()` synchronously returns the latest snapshot copy, not a Promise.
- `action(actionId, input?)` requests a registered host action and returns its result.
- `saveState(state)` persists an explicit JSON view-state object.

A snapshot contains `data`, `dataRevision`, `bindings`, `viewState`,
`stateRevision`, `actions`, optional `question`, and `sampledAt`. The first snapshot is sent on
connection; later snapshots are delivered through a dedicated MessageChannel.
A data-only change does not replace the block DOM or restart its animation.
Snapshots are batched per canvas and delivered only to changed blocks. Static
blocks do not receive periodic callbacks. The host polls only canvases with clock
bindings, pending question continuations, or running Agent actions; unchanged
snapshots are suppressed, excluding the sampling timestamp from comparison.

Source JavaScript runs immediately with block-scoped `window`, `document`, and
`avesBlock` bindings. `document.getElementById`, `querySelector`, and
`querySelectorAll` address the block's Shadow DOM; `body` and `documentElement`
address its local body and HTML nodes. Selecting `html` or `body` returns the same
local node as the corresponding property or `querySelectorAll` result.
CSS can target `html`, `body`, or `:host`;
use `:host` instead of `:root`. Attach handlers from JavaScript rather than inline
HTML attributes, and do not wait for document load events. Common timers,
animation frames, and document/window listeners are tracked and removed on
replacement or removal. Restore persistent presentation state with `saveState`.
Do not create shared globals or access another block's DOM.

A binding is `{key, sourceId, fields?}`. The initial sources are `clock`, with
`now` and `iso` updated once per second, and `block:<id>`, with data from a block
in the same canvas. Optional `fields` restricts what the recipient receives.
These sources do not depend on the legacy widget/data-source implementation.
Deleting a source block requires removing or rebinding dependent subscriptions
in the same batch.

Replacing block data through the Agent tool requires `expectedDataRevision`.
Host data actions also check the data revision. Data and view-state updates use
independent revisions and do not increment the canvas/source revision.

## Host actions

An action binding contains `id`, `label`, `capability`, optional `parameters`,
and optional `inputFields`. Generated code can invoke only registered IDs.
Fixed target IDs and task descriptions cannot be overridden by input fields.
The document bridge accepts action requests only during browser user activation.

Initial capabilities are:

- `block.set_data`: patch or increment the calling block's current data. Numeric
  increments require existing numeric fields. Optional fixed `patch` and
  `increment` objects are validated by the host.
- `canvas.open`: open/focus a declared existing canvas.
- `agent.respond`: accept this block's declared question answers and continue its
  original live Agent conversation. Acceptance returns immediately; snapshots report
  subsequent progress. This action does not create an Agent session or show a
  separate task-start confirmation.
- `agent.task`: present the declared task through a trusted host confirmation
  dialog, then start a Reasoning session. The dialog defaults to Cancel.
  Declining or removing/replacing the block before confirmation prevents launch.

Action requests have an execution ID. Identical retries are deduplicated;
reusing an ID with different input is rejected. Results report running,
completed, or error states. The latest eight results for a block are delivered
in snapshots. Agent task replies and terminal status are reflected through that
same snapshot channel. Each task result belongs to its launched execution.
Cancellation settles that action as an error with task status `cancelled`,
releasing the block for another action. Reusing or removing the conversation
does not change the settled reply or task outcome. Only one action/task may
be active for a block at a time.

## Isolation and observation

The host serves one sandbox runtime per canvas under a random `aves-block:`
URL. Its iframe uses `allow-scripts allow-forms` and an opaque origin. Source
changes install only the affected block; the iframe URL, other DOM roots, input
state, and animations remain in place. A replacement is initialized before
switching the visible root. A failed initialization keeps the prior display.

Form events and browser validation are supported so generated code can cancel
submission and use a registered action. A response CSP blocks network, imports,
nested frames, form navigation, and remote resources; images and fonts may use
inline data URLs. The sandbox has no preload, Node, Electron, workspace file
access, or credentials. Cross-document and popup navigation are denied.

Shadow DOM and scoped bindings provide style and lifecycle separation, not a
security boundary between blocks. All generated code in a canvas shares one
JavaScript environment and trust boundary. Arbitrary code can interfere with
other blocks, and a synchronous infinite loop can stall the entire sandbox.
Host privileges remain outside that boundary and are checked for every request.

Only the owning trusted canvas main frame can mount a lease or forward its
messages through typed IPC. The main process retains a separate lease for each block version and rechecks owner, generation,
source revision, registered action, arguments, and independent state/data
revisions. Source code is never evaluated in the main process.

The block facade, preload result envelopes, and renderer client preserve each
request type's result through the shared `BlockResults` mapping. Runtime dispatch
checks each handler against that mapping. IPC registration accepts declared window
channels and their result types; incoming payloads still require runtime parsing
and sender authorization.

The host lease registry owns structural lease and deduplicated-request mutations.
Registering a lease attaches native-owner cleanup once; explicit release, canvas
release, and native destruction share the same lease/request cleanup path.
Inspection receives iteration access, and runtime authorization still checks each
request's owner and canvas before using registry records. Ended leases cannot
retain requests whose admission resumes after an asynchronous read.

Block-to-Agent task confirmation and launch policy belong to a small main-process
adapter. Desktop startup supplies the native confirmation, current session host,
and workspace reader. The adapter checks acceptance and block activity, resolves
the owning workspace, and launches through `AgentSessions.startTask`; execution
results remain owned by the launched execution.

Inspection captures visible mounted blocks from the native canvas webContents,
up to four PNGs per call, and checks that the inspected source/data revision
has not changed during capture. Offscreen or unopened blocks have no capture;
open the canvas and adjust its view first. Runtime readiness and a screenshot
do not prove full functional correctness. Iframe isolation does not impose a
per-document CPU/memory quota or guarantee a separate renderer process.

## Canvas questions and original-session continuations

Create a question document with `question: {id, title, fields}` and register an
`agent.respond` action using exactly `parameters: {questionId}` and
`inputFields: ["answers"]`. Fields have `key`, `label`, `type`, and optional
`required` (defaults to true). Types are `single_choice`, `multiple_choice`,
and `text`; choices require `options: [{value, label}]`. Text has no options.
There are at most eight fields and 32 options per field. Text answers are
limited to 4096 characters and the entire answer remains a bounded JSON object.
The host validates required answers, unknown fields, choice membership, and
repeated selections. This metadata does not define a fixed visual component.
Invalid answer structure or semantics returns `INVALID_ARGUMENT` before acceptance
is persisted or a continuation starts. Error responses do not echo submitted answers.

The calling interactive session must be live and responding. The host binds
its session ID, Agent connection identity, and originating turn; none can be
supplied by generated source or tool arguments. There is at most one pending
question per session turn, across all canvases. Source-only updates preserve
the question. Replacing question metadata requires replacement source, creates
a new question generation/revision, and clears the old answer. `question: null`
clears the question and requires removing its response action in the same batch.
Only the asking session can replace a question's source, actions, or metadata.
Moving or deleting a question does not grant another session ownership.

Generated code submits `avesBlock.action(actionId, {answers: {fieldKey: value}})`.
The bridge attaches the inspected question revision. Persisted acceptance is
idempotent for the question and normalized answers even after reopening its
window. Different answers to an accepted question are rejected; a new question
is required to revise them. Retrying an identical action request ID returns its
original receipt. After a failed continuation, a new click/request ID with the
same saved answers retries only while that attempt has not been superseded.

`onData` receives `question` with `id`, `title`, `fields`, `revision`, `status`
(`pending`, `answered`, `unavailable`), `canRetry`, and, once accepted,
`answers`, `submissionId`, and `continuation` (`queued`, `running`, `completed`,
`error`, `unavailable`). Question ownership is never exposed to generated code.
Show acceptance and progress separately, preserve the selected answers, disable
normal resubmission, and provide a retry only when `canRetry` is true.

The Agent renders, opens, and inspects its question, then ends the current turn
normally. The tool call does not wait for a human. An early answer is queued
until the original turn finishes; the next prompt reuses the same Agent session
and includes question semantics and accepted answers as user data. The original
conversation can then ask another question or update the canvas with a result.
Switching selected conversations or closing the canvas never retargets an answer.
Queued continuations recheck that their question still exists before starting.

Question semantics and accepted answers persist locally. Session transcripts,
queues, and Agent connections remain in memory. After application exit, host
disposal, session removal, or stop, a question cannot reconnect into a fresh Agent
conversation. Accepted answers remain visible; continuation reports unavailable.
An ordinary new user turn also makes a prior unanswered question unavailable.
Transport/model failures can occur after a provider has already done work;
explicit retries may repeat that work, so external execution is not claimed to
be exactly once.

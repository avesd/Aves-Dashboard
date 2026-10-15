# Agent sessions

Avesd routes agent requests through three tiers: `flagship`, `reasoning`, and
`action`. Settings maps each tier to an installed ACP provider, model ID, and
effort ID. Blank IDs use that adapter's default. Explicit IDs must be supported
by the connected ACP; unsupported values fail before the prompt is sent.
The chat composer exposes one ACP/model/effort picker and a new-conversation
button. Opening the picker discovers current model choices; changing the model
reloads its efforts. Apply connects the selected configuration without sending
an inference request. Check access explicitly sends one short request.
Installation and enablement remain in Manage ACPs, with runtime source and
version shown in the picker. Codex uses its adapter-bundled compatible CLI by
default; explicit custom paths are preserved and can be reset with Use bundled
runtime.

Choosing another ACP creates a new conversation and retains the previous
session. Changing the model or effort preserves the live ACP connection and is
allowed only while idle with no pending canvas question. Background conversations
are never silently retargeted by the chat picker. Chat choices update the
Flagship default for future interactive conversations. Session summaries expose
the pinned route, while connected settings report actual model/effort choices.

Provider registration, installation detection/storage, launch strategy creation,
process environments, and model discovery live in
[`@avesd/acp-management`](../packages/acp-management/README.md). The desktop's
`acp-registry.ts` supplies the built-in adapter registrations and Electron launch
context. Provider IDs and settings pickers are registry-driven; extending ACP
support does not require editing provider enums in IPC or renderer code.

Model and effort selectors load their options from a fresh ACP session. Changing
the model reloads its effort choices and resets the selected effort to the ACP
default. Saved IDs that are no longer offered remain visible until replaced;
they are never silently substituted. Refresh models retries discovery. An ACP
that does not report model options can still use its default.

Discovery does not send a model prompt. Test connection sends one fixed short
request using the selected model and effort, which may consume provider quota.
A successful test confirms that request only; listed models are not guaranteed
to remain accessible. Changing the selection or refreshing clears the result.
Discovery and tests use temporary sessions without Avesd MCP tools, do not appear
in Sessions, and do not change saved routes or existing conversations. Checks
are limited to three concurrent operations with a 45-second operation deadline
and clean up their adapter processes and scratch directories afterward.

The client negotiates the adapter's structured session-failure extension.
Terminal failure metadata marks the request as failed even when the ACP stop
reason is `end_turn`; ordinary assistant text is never parsed as an error.
Failures show a bounded local message. Sending another message retries the
connection in the same session. Model and CLI
compatibility still depend on the selected local provider installation.

Each new session captures its tier configuration. Changing settings does not
change sessions already created. Widgets receive the tier abstraction, not
provider installation paths or model configuration.

## Session directory

Canvas questions attach to the calling interactive session and its live ACP
connection. After a question turn completes, the session can show Waiting for
answer. Submitted answers are saved locally and queued for the original session;
a continuation sends another prompt to the same ACP session ID. It never creates
a replacement session. Early answers wait for the running turn to finish.
See [canvas questions](dashboard-blocks.md#canvas-questions-and-original-session-continuations).

The controller starts or continues an interactive Flagship conversation when a
message is sent. Its Sessions panel lists retained conversations and can create a
new one. Shared settings configure provider routes. Stop terminates a running
session; Remove terminates and releases a session and its transcript. A stopped session retains its transcript but cannot be resumed.

Closing a panel, switching the selected session, or changing dashboards does
not cancel a task. Interactive sessions use explicit canvas IDs and are
independent of the originating dashboard. They discover and operate local canvases through the
[canvas service](canvas-service.md). Widget background sessions retain their originating workspace and dashboard
metadata but receive no Avesd MCP server or product-operation tools. They work
from content supplied in their prompts. Widget API calls still recheck source
identity and the declared agent capability.

Sessions and conversations currently remain in memory until application exit;
they are not imported from external ACP clients or resumed after restart.
Tier settings persist. Legacy sidebar preferences remain stored for compatibility.
The application allows 32 sessions and eight concurrent prompts, and bounds each retained event stream
to approximately 512 KiB of serialized text. Remove old sessions to free slots.

## Widget API

Declare `"agent"` in the widget manifest's `capabilities`, then use the optional
`context.agent` service:

```js
const { id } = await context.agent.start({
    tier: "reasoning",
    prompt: "Summarize this supplied task list: review the draft and prepare the meeting.",
});
const result = await context.agent.read(id);
// { id, tier, status, answer }
// await context.agent.cancel(id);
```

`start` returns immediately; `read` exposes accumulated assistant text and an
`idle`, `running`, `completed`, `error`, or `stopped` status. A widget can read
or stop only sessions created by that widget in the same workspace. Prompts
must be nonempty and at most 32,000 characters. Handle rejected calls and
stop polling when the mount signal is aborted. Store any results needed after
application exit through the widget's declared storage services.

These tasks appear in Sessions under Background. Unmounting the widget does
not stop its agent, but removes its live service access. The `agent` capability
allows background text tasks without access to Avesd product state. Draft previews cannot launch agents or inspect live
sessions.

## ACP tool permission identity

Interactive ACP permission requests remain limited to the five registered
Avesd dashboard tools. Wrapper-style input identifies the `avesd` server
and exact tool name. OpenCode uses the qualified identifier
`avesd_<registered-tool-name>` in its tool name or title and direct tool
arguments. Its identifier must match exactly with the `other` tool kind. OpenCode can
request permission before emitting arguments, using an empty input object.
That phase authorizes only the registered tool identity; when arguments are
already present they must pass its input schema. The gateway validates every
actual call before executing it. A partial ACP
tool update retains the previous name/title/kind and arguments for the
permission request. Displayed titles do not change the actual MCP tool names
or add aliases. The authenticated gateway still validates arguments, caller
access, mutation revisions, and question ownership before any operation.

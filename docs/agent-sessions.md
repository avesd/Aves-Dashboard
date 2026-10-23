# Agent sessions

The desktop uses GPT-Live for voice and a direct DeepSeek Chat Completions tool
loop for Agent execution. The desktop calls the provider API directly and
dispatches validated tools locally.

## Configuration

The controller opens settings in a separate, single-instance native window.
Its renderer lives in [packages-renderer/settings](../packages-renderer/settings/README.md).
Saved defaults synchronize across windows. Settings drafts carry a revision;
external changes require reloading a dirty draft before saving. Existing Agent
sessions retain their pinned configuration.


Use **Settings → Models & services** to save, replace, delete and test DeepSeek
and OpenAI keys. API keys have one source: local secure settings. Environment
variables and `.env` files are never used for credentials. The password field is
write-only; saved keys are never returned to the renderer. The transient field is
cleared on submission or cancellation. Keys never enter messages, tools or logs.

The main process encrypts each key through Electron safeStorage and atomically
replaces an owner-only ciphertext file under `<userData>/credentials-v1`. macOS
uses Keychain-backed encryption, Windows uses DPAPI, and Linux requires an
available supported secret store. Plaintext fallback is rejected. If secure
storage is unavailable, saving fails without replacing an existing key. Corrupt
or locked keys are reported safely and can be replaced or deleted. See the
[Electron safeStorage contract](https://www.electronjs.org/docs/latest/api/safe-storage/).

Only the settings window main frame can manage keys. Revisions reject stale
writes and stale test results. Tests send a request to the provider's models
endpoint with a timeout and no redirects; provider response bodies are not
exposed. This checks authentication and connectivity, not generation, billing,
model permissions or GPT-Live access. See the [OpenAI models endpoint](https://developers.openai.com/api/reference/resources/models/methods/list)
and [DeepSeek models endpoint](https://api-docs.deepseek.com/api/list-models/).

Every new Agent HTTP request and voice connection resolves the current saved key.
Deletion prevents later requests; an already authenticated voice connection
continues until disconnected. Existing in-flight HTTP requests may finish. Saving
does not automatically test a key or interrupt running work. Provider and voice
availability refresh across windows without restarting.

Non-secret model defaults still support `DEEPSEEK_MODEL` through the local
stage environment files. The loader reads stage defaults, `.env.local`, then
`.env.<stage>.local`; process values take precedence. Packaged apps use
`<userData>/env`; `AVESD_ENV_DIR` selects an alternate directory. These defaults
require restart; per-tier model selections are managed in Settings.

DEEPSEEK_MODEL defaults to deepseek-flash. The initial runtime explicitly disables
thinking and uses bounded non-streaming requests. See the
[DeepSeek API contract](https://api-docs.deepseek.com/api/create-chat-completion/).
Model choices are local configuration, not live discovery. Check access sends
one short request without tools and can consume quota. Configured status only
means that a key exists. Old provider tier routes migrate to DeepSeek defaults.

## Execution and tools

Each session pins a tier route (flagship, reasoning or action). Interactive
sessions receive only the five existing canvas tools. Widget background sessions
receive no tools and operate on supplied text. Each returned tool name and JSON
argument is validated before the existing domain operation runs. Its result is
appended as a tool message before requesting the next model response.

A turn permits eight model rounds, 16 tool calls per response, a 60-second
request timeout, and bounded history/results. There are no automatic request
retries. Screenshot image payloads are omitted from this text-only MVP; the model
receives inspection metadata and an explicit omission flag. Saved state is not
visual verification.
Reaching the history limit preserves its safe `BUSY` error and asks for a new
conversation. Retrying the same exhausted conversation does not send another
provider request. Unexpected failures remain sanitized.

The local AgentSessions layer retains the existing session directory, canvas
question continuations, widget ownership, concurrency limits, transcripts and
supplement queue. Sessions remain in memory until exit. Changing models is
allowed only while idle without a pending canvas question. Local canvases remain
usable without any account or API connection.

Text submission state belongs to its target conversation. A pending request in
one conversation does not block another idle conversation; switching selection
shows the selected conversation's own pending state.

## Cancellation, supplements and authorization

- Stop speaking affects audio only.
- cancelTurn revokes the current execution immediately, clears queued supplements
  and pending question continuations, and aborts the DeepSeek request. After it
  settles, the same conversation accepts another prompt. Cancelled tool batches
  receive matching interruption records so subsequent messages remain coherent.
- Cancellation does not undo committed operations. An admitted mutation may
  finish; inspect state and reuse the original mutation receipt/request ID when
  resolving uncertain outcomes.
- A host that does not settle within five seconds is disposed. The next turn
  starts fresh model context; the local transcript reports this reset.
- enqueue accepts up to 16 supplemental prompts of at most 32,000 characters.
  They execute FIFO after the active turn and pending question continuation.
  Failure/cancellation discards remaining additions. A change invalidating current
  work requires cancellation followed by a new prompt.
- cancel still permanently stops a session; remove releases its transcript.

The execution ID is supplied directly by the trusted session manager, not by
model-generated arguments. Each tool captures that exact execution's revocable
authorization callback. The host checks before dispatch and after awaits;
CanvasService checks again inside its storage transaction. Completion and
cancellation revoke the callback permanently. New turns cannot authorize old
responses. The legacy local-host gateway keeps its independent compatibility
contract.

## Verification

Run `pnpm --filter @avesd/desktop test` and `pnpm validate`.
The direct integration tests use controlled HTTP responses with real canvas
operations and the real session manager: tool-result round trips, cancellation
followed by conversation reuse, FIFO supplements, and late-response rejection.
The storage tests verify cancellation before transaction admission prevents
mutations. dotenv tests cover override order and the variable allowlist.
These checks do not prove access to the paid DeepSeek or GPT-Live services.

## GPT-Live voice entry point

The controller starts as a compact voice surface with microphone controls, task
feedback, cancellation, and explicit **Text input** and **View details** actions.
**View details** expands the conversation, canvas list, and sessions; **Text input**
opens the conversation composer. Hiding details preserves the draft, transcript,
and active voice connection. Switching detail panels also leaves voice running.
**Cancel task** remains available for running work, pending answers, and queued
requests independently of text input visibility and the voice connection. It does
not undo completed changes. Settings are accessible in both window sizes.

The controller's **Start voice** button connects `gpt-live-1` using WebRTC and
`delegation: { type: "client" }`. Save an OpenAI key in Settings. The project must have GPT-Live access and
billing enabled. The optional voice connection does not affect offline canvas
or text Agent functionality. Saved API keys are not returned to the controller renderer.

The main process exchanges the renderer's SDP offer at
`POST https://api.openai.com/v1/live/sessions`. Audio travels on WebRTC tracks;
the authenticated controller forwards an allowlist of data-channel events over
IPC. This MVP uses the data channel, not a second sideband connection. The main
process is the sole delegation executor. Microphone permission is restricted to
audio capture by the controller's main frame. Start is an explicit user action;
ending voice or a transport failure releases the microphone. Hiding details or
closing the controller window returns it to compact mode without ending voice.
Quitting the application, reloading, or losing the renderer releases the connection. Switching Agent conversations ends the old
voice connection rather than retargeting it.

Semantics:

- GPT-Live handles natural spoken interruption on its full-duplex media stream.
  **Stop speaking** also immediately mutes local playback and sends a stop-speech
  instruction. **Resume audio** restores playback. Neither action cancels DeepSeek work.
- **Cancel task** calls the existing recoverable `cancelTurn`, clears additions,
  and revokes execution authorization. A standalone delegated transcript matching
  `取消当前任务`, `取消任务`, `停止当前任务`, `cancel the task`, or
  `cancel current task` uses the same path. This is a deliberately narrow command
  vocabulary, not general natural-language intent classification. Transcripts
  are imperfect; the explicit button is the deterministic cancellation control.
- A delegated workspace request runs on the fixed selected DeepSeek conversation. If
  that conversation is busy or awaiting a canvas answer, the request uses its
  existing FIFO supplement queue. It does not rewrite an in-flight tool call.
- Ending voice leaves already accepted DeepSeek work and its queue running. Future
  speech updates are discarded. Completed mutations are never rolled back by
  either voice interruption or task cancellation.

Client delegation events contain an ID and timestamp, not task text. The bridge
keeps bounded in-memory transcript fragments and allows 750 ms for late delivery
before assembling context around the delegation timestamp. That delay is not an
utterance-end detector. Missing context asks for repetition; the DeepSeek prompt must
clarify incomplete or ambiguous requests. Duplicate delegation IDs are ignored.
The delegation ID, exact queued prompt, execution ID and transcript sequence are
associated before returning a result. Only completed assistant message chunks
are returned, in a short excerpt; thought chunks and raw tool output are not
sent to the voice model. Cancellation, removed sessions, closed connections and
stale connection IDs suppress late delivery. The existing per-execution tool
authorization remains authoritative.

Live transcripts are held in memory. Delegated text enters the existing Agent
conversation. Audio and session payloads are not logged. Voice audio goes to
OpenAI; delegated requests also go to the selected DeepSeek provider. Voice output is
AI-generated. Ending normally requests `session.close`; if the connection fails
before `session.closed`, final usage is unconfirmed. There is no automatic retry
of session creation or task execution.

Verification: desktop unit/integration tests exercise client-delegation result
association, deduplication, FIFO additions, cancellation and continued use,
execution revocation, late-result suppression and connection isolation with an
in-memory session host.
Actual microphone quality, Chinese dialogue latency, natural barge-in and paid
GPT-Live connectivity require a project key and an on-device voice test.

Protocol references: [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc),
[client delegation](https://developers.openai.com/api/docs/guides/live-delegation).

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


Copy `env/.env.local.example` to `env/.env.development.local` and set
`DEEPSEEK_API_KEY` for tasks and `OPENAI_API_KEY` for optional voice.
Never commit actual keys. Development defaults live in `env/.env.development`;
production defaults live in `env/.env.production`. Local files are ignored.

The main process uses dotenv to load stage defaults, then `.env.local`, then
`.env.<stage>.local`. Existing process variables take precedence, including empty
values. Only DEEPSEEK_API_KEY, DEEPSEEK_MODEL and OPENAI_API_KEY are imported.
Restart after changes. Packaged apps read from `<userData>/env`; AVESD_ENV_DIR
can explicitly select a configuration directory. Credentials never enter preload,
renderer settings, model messages, tools, or logs.

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

The local AgentSessions layer retains the existing session directory, canvas
question continuations, widget ownership, concurrency limits, transcripts and
supplement queue. Sessions remain in memory until exit. Changing models is
allowed only while idle without a pending canvas question. Local canvases remain
usable without any account or API connection.

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

The controller's **Start voice** button connects `gpt-live-1` using WebRTC and
`delegation: { type: "client" }`. Set `OPENAI_API_KEY` in the desktop process
environment before launching Avesd. The project must have GPT-Live access and
billing enabled. The optional voice connection does not affect offline canvas
or text Agent functionality. No API key reaches the renderer.

The main process exchanges the renderer's SDP offer at
`POST https://api.openai.com/v1/live/sessions`. Audio travels on WebRTC tracks;
the authenticated controller forwards an allowlist of data-channel events over
IPC. This MVP uses the data channel, not a second sideband connection. The main
process is the sole delegation executor. Microphone permission is restricted to
audio capture by the controller's main frame. Start is an explicit user action;
ending voice, leaving the chat panel, collapsing the controller, or a transport
failure releases the microphone. Switching Agent conversations ends the old
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

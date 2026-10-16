# Agent sessions

The desktop uses a direct DeepSeek Chat Completions tool loop for Agent execution. The desktop calls the provider API directly and
dispatches validated tools locally.

## Configuration

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

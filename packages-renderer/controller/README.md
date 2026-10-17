# Controller renderer

Owns the floating controller UI, view bootstrap, transcript, runtime picker,
voice controls and styles. The desktop supplies its HTML shell and injected
ControllerApi. Native positioning, window lifecycle, credentials, persistence
and Agent execution remain in the desktop main process.

The renderer imports shared contracts from @avesd/desktop-contracts, never
desktop internals or another renderer's implementation. Shared Markdown and
transcript helpers live in `src/chat/`; shared model-option loading lives in
`@avesd/renderer-agent`. UI foundations live under `packages-ui/*`.

Only the native controller receives the --avesd-controller launch argument.
Its sandbox preload exposes avesdController: session operations, provider
listing, canvas listing, canvas presentation, voice and the settings launcher.
It does not expose the legacy desktop API, filesystem/storage, plugin management,
block mutations, or arbitrary IPC. Main-process sender and frame checks remain
authoritative. Canvas windows use the separate @avesd/renderer-canvas entry and CanvasApi.

Run pnpm validate and pnpm --filter @avesd/desktop test. Native checks cover
collapse/expand, chat/session navigation, model selection, settings launch/sync,
voice availability and opening a canvas.

The host composes this bridge from capability-specific IPC clients. It does not
construct or expose a legacy aggregate DesktopApi.

Source is grouped into `chat/`, `sessions/`, `canvases/`, `runtime-picker/`, and
`voice/`. The Controller composes these features. Subscription hooks retain
request-generation guards and cleanup; the runtime picker owns one draft/probe
state shared by its fields and dialog.

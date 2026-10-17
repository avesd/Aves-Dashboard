# Canvas renderer

Owns canvas bootstrap, viewport interactions, context menu, sandbox block
presentation and styles. The desktop supplies the HTML shell and injected
CanvasApi; shared schemas come from @avesd/desktop-contracts.

Only native canvas windows receive --avesd-canvas. Their sandbox preload exposes
avesdCanvas with canvas read/subscription, block runtime operations, view
inspection/subscription and the controller launcher. It exposes no credentials,
storage, Agent execution, settings, arbitrary IPC or canvas catalog mutations.
Main-process sender/frame checks, canvas ownership and block leases remain
authoritative. Native window reuse, protocol handling and persistence remain
in the desktop host.

Run pnpm validate and pnpm --filter @avesd/desktop test. Native checks cover
block rendering, interaction, pan/zoom/reset, controller access and multiple
canvas windows.

The host composes this bridge from capability-specific IPC clients. It does not
construct or expose a legacy aggregate DesktopApi.

The `src/blocks/` feature separates the React iframe binding, sandbox lifetime
and mount synchronization, and validated message handling. One sandbox owner
retains mount versions, request ordering, and cleanup across asynchronous calls.

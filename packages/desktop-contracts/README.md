# Desktop contracts

Runtime-neutral contracts and schemas shared by the desktop main/preload and
independent renderers. No Electron, React, credentials or persistence code
belongs here. Subpath exports separate Agent sessions, settings, voice, canvas
resources, block operations and window views.

The desktop shared modules retain re-exports for existing canvas and legacy
callers. Importing contracts does not grant capabilities; the preload capability composition
and main-process authorization enforce access.

The ipc-commands subpath defines the current window command schemas and their
request/result mapping. Agent and settings commands use strict objects; routes
and prompts are normalized by the shared schemas. Existing canvas, block, view
and Live schemas remain authoritative for their domains. Preload invokes use
WindowWireInvoke, and command handler tables use CommandHandlers to check each
command's result. Electron response values are trusted host output, not runtime
validated by these TypeScript types.

Controller identity checks do not fetch or require Agent sessions. Only commands
that use Agent execution request that service after authorization and validation.
Settings keeps its separate registered-window/main-frame authorization; canvas
operations retain their window scope and block leases.

Compatibility widget/browser/workspace channels retain their existing parsers
and wire formats. Contract changes must not turn them into general renderer IPC.
The settings preload imports the command mapping as a type only so its sandbox
entry remains self-contained.

The ipc-result subpath defines IpcResult and the string enum IpcErrorCode.
Current window commands return a plain success value or a safe error with an
explicit code (PERMISSION_DENIED, INVALID_ARGUMENT, VERSION_CONFLICT,
SERVICE_NOT_READY, NOT_FOUND, BUSY or INTERNAL). Revision conflicts can include
currentRevision. Unexpected host errors are masked; stacks, causes and request
inputs never enter the error envelope.

Preloads expose WireApi envelopes unchanged across contextBridge. Renderer
entry points use createWindowClient to unwrap them into renderer-local IpcError
instances, preserving codes that Electron would otherwise strip from thrown
errors. Synchronous subscriptions retain their original behavior. All three
windows use ipcErrorMessage for consistent recovery guidance; settings marks a
draft conflicted only on VERSION_CONFLICT. These codes do not grant access or
automatically retry mutations. Domain probe outcomes retain their existing
business result inside the transport envelope.

Current window handlers register explicitly with handleWindow; compatibility
handlers retain plain ipc.handle registration. There is no channel whitelist
that must be updated separately.

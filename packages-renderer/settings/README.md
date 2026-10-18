# Settings renderer

This workspace owns the desktop settings UI, styles, and renderer entry.
The desktop application supplies the HTML shell, build integration, dedicated
preload, and native window lifecycle. The desktop calls mountSettings(root, api),
matching the injected entry points of the controller and canvas packages.
The renderer entry does not read a global bridge or mount itself on import.

Settings API and Agent configuration types are imported directly from
@avesd/desktop-contracts. Renderer code must
not import desktop internals, Node, Electron, credentials, or persistence.

The settings preload exposes provider status, write-only key saving, deletion,
explicit connection tests, official setup links, model checks, route preferences,
and change notifications. Saved secrets and encrypted bytes are never returned.
`ApiKeySettings` owns status refresh; `ApiKeyCard` owns transient password entry,
replacement, deletion confirmation and revision-bound feedback. The main process
owns system encryption, persistence and all authenticated network requests. There
is no environment-variable credential fallback. The main process
checks the registered settings webContents and its exact main frame for every
command. The window uses an isolated session with permissions denied, sandboxing,
context isolation, and navigation/popups blocked.

A settings window is created on demand, focused on repeated opens, and recreated
after closing. Closing it does not terminate Agent work. Successful persisted
changes notify both windows. Saved revisions prevent an older settings draft
from overwriting another window's changes. Dirty route drafts require explicit reload
after route revisions change; credential-only notifications preserve them. Existing conversations keep their pinned route; changes
apply to new sessions. The controller updates only the Flagship default.

Choose checks by change scope using the root AGENTS.md. Native verification
uses isolated test data for affected settings and window behavior.

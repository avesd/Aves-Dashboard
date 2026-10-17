# Settings renderer

This workspace owns the desktop settings UI, styles, and renderer entry.
The desktop application supplies the HTML shell, build integration, dedicated
preload, and native window lifecycle. The desktop calls mountSettings(root, api),
matching the injected entry points of the controller and canvas packages.
The renderer entry does not read a global bridge or mount itself on import.

Settings API and Agent configuration types are imported directly from
@avesd/desktop-contracts. Renderer code must
not import desktop internals, Node, Electron, credentials, or persistence.

The settings preload exposes only provider status, official setup links, model
checks, configuration reads/writes, and change notifications. The main process
checks the registered settings webContents and its exact main frame for every
command. The window uses an isolated session with permissions denied, sandboxing,
context isolation, and navigation/popups blocked.

A settings window is created on demand, focused on repeated opens, and recreated
after closing. Closing it does not terminate Agent work. Successful persisted
changes notify both windows. Saved revisions prevent an older settings draft
from overwriting another window's changes. Dirty drafts require explicit reload
after external updates. Existing conversations keep their pinned route; changes
apply to new sessions. The controller updates only the Flagship default.

Choose checks by change scope using the root AGENTS.md. Native verification
uses isolated test data for affected settings and window behavior.

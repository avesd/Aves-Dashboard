# Canvas and block rendering architecture

Avesd has independent canvas windows and a separate always-on-top controller
for Agent conversations, canvas browsing, and shared settings. Agents place
independent HTML/CSS/SVG documents in the canvas. Optional presentation
JavaScript receives data and requests registered host actions through a small
runtime bridge. The previous fixed business content types remain removed.

The host controls block identity, world-space bounds, source versions, data,
and saved view state. Generated blocks share one sandboxed iframe per canvas,
with separate Shadow DOM roots and no direct privileged APIs. CSS transforms position and scale the DOM containers
with the canvas viewport. Multiple pieces of information can occupy separate
blocks without a mandatory card frame or business-type template.

People pan empty space and zoom around the pointer. The context menu offers
Reset view and Ask agent. Command/Ctrl+0 resets the viewport; Command/Ctrl+K
opens the controller. Interaction inside a block belongs to its generated
document. Viewport state is local to the window and resets when it reopens.

Canvas resource operations and block source changes use validated serialized
main-process transactions. Data-only changes preserve the document and use
independent data revisions. A replacement source loads before display; failures
retain the previous display. The five `aves_dashboard_` tools expose discovery,
window presentation, capabilities, mutation, and actual output inspection.

See [Dashboard blocks](dashboard-blocks.md) for the source/bridge/action contract,
[Canvas service](canvas-service.md) for resource transport and receipts, and
[Design language](design-language.md) for presentation principles. Legacy widget
and plugin state remains stored for compatibility and is not part of block
rendering.

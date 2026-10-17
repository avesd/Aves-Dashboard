/**
 * @author Avesd
 * @package Desktop
 * @namespace Renderer_Src
 * @description Canvas
 */

import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import { createWindowClient } from "@avesd/desktop-contracts/ipc-result";
import type { CanvasApi } from "@avesd/renderer-canvas/contracts";
import { mountCanvas } from "@avesd/renderer-canvas/entry";

declare global {
    interface Window {
        readonly avesdCanvas: WireApi<CanvasApi>;
    }
}
const root = document.getElementById("root");
if (!root) {
    throw new Error("Canvas root is unavailable.");
}
mountCanvas(root, createWindowClient<CanvasApi>(window.avesdCanvas));

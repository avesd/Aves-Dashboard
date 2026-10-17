/**
 * @author Avesd
 * @package Desktop
 * @namespace Renderer_Src
 * @description Controller
 */

import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import { createWindowClient } from "@avesd/desktop-contracts/ipc-result";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";
import { mountController } from "@avesd/renderer-controller/entry";

declare global {
    interface Window {
        readonly avesdController: WireApi<ControllerApi>;
    }
}
const root = document.getElementById("root");
if (!root) {
    throw new Error("Controller root is unavailable.");
}
mountController(root, createWindowClient<ControllerApi>(window.avesdController));

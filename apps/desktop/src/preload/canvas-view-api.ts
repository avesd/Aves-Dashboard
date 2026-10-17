/**
 * @author Avesd
 * @package Desktop
 * @namespace Preload
 * @description Canvas View API
 */

import { createBlocksClient, createCanvasClient, createViewsClient } from "./canvas-api";
import type { PreloadIpc } from "./preload-ipc";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import type { CanvasApi } from "@avesd/renderer-canvas/contracts";

/** Canvas reads and lease-scoped block operations remain authorized by the host. */
export function createCanvasApi(ipc: PreloadIpc): WireApi<CanvasApi> {

    const canvases = createCanvasClient(ipc);
    const views = createViewsClient(ipc);

    return {
        canvases: {
            read: canvases.read,
            subscribe: canvases.subscribe,
        },
        blocks: createBlocksClient(ipc),
        views: {
            inspect: views.inspect,
            subscribe: views.subscribe,
            controller: views.controller,
        },
    };
}

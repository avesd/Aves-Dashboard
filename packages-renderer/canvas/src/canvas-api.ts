/**
 * @author Avesd
 * @package Renderer Canvas
 * @namespace Root
 * @description Canvas API
 */

import type { DashboardBlocksApi } from "@avesd/desktop-contracts/canvas/blocks";
import type { CanvasServiceApi } from "@avesd/desktop-contracts/canvas/contracts";
import type { DesktopViewsApi } from "@avesd/desktop-contracts/canvas/views";

export interface CanvasApi {
    readonly canvases: Pick<CanvasServiceApi, "read" | "subscribe">;
    readonly blocks: DashboardBlocksApi;
    readonly views: Pick<DesktopViewsApi, "inspect" | "subscribe" | "controller">;
}

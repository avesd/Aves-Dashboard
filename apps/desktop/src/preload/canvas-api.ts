/**
 * @author Avesd
 * @package Desktop
 * @namespace Preload
 * @description Canvas API
 */

import type { DashboardBlocksApi } from "../shared/canvas/blocks";
import { dashboardBlocksChannels } from "../shared/canvas/blocks";
import type { CanvasChange, CanvasServiceApi } from "../shared/canvas/contracts";
import { canvasServiceChannels } from "../shared/canvas/contracts";
import type { DesktopViewsApi } from "../shared/canvas/views";
import { desktopViewChannels } from "../shared/canvas/views";
import type { PreloadIpc } from "./preload-ipc";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";

export function createCanvasClient(ipc: PreloadIpc): Pick<WireApi<CanvasServiceApi>, "list" | "read" | "subscribe"> {

    return {
        list: async input => {

            return ipc.invoke(canvasServiceChannels.request, {
                ...input,
                type: "list",
            });
        },
        read: async canvasId => {

            return ipc.invoke(canvasServiceChannels.request, {
                type: "read",
                canvasId,
            });
        },
        subscribe: listener => {

            const handler = (_event: Electron.IpcRendererEvent, change: CanvasChange) => {

                listener(change);
            };
            ipc.on(canvasServiceChannels.changed, handler);

            return () => {

                ipc.off(canvasServiceChannels.changed, handler);
            };
        },
    };
}
export function createBlocksClient(ipc: PreloadIpc): WireApi<DashboardBlocksApi> {

    return {
        invoke: input => {

            return ipc.invoke(dashboardBlocksChannels.request, input);
        },
        subscribe: listener => {

            const handler = () => {

                listener();
            };
            ipc.on(dashboardBlocksChannels.changed, handler);

            return () => {

                ipc.off(dashboardBlocksChannels.changed, handler);
            };
        },
    };
}
export function createViewsClient(ipc: PreloadIpc): Pick<WireApi<DesktopViewsApi>, "inspect" | "open" | "controller" | "subscribe"> {

    return {
        inspect: () => {

            return ipc.invoke(desktopViewChannels.request, { type: "inspect" });
        },
        open: canvasId => {

            return ipc.invoke(desktopViewChannels.request, {
                type: "open",
                canvasId,
            });
        },
        controller: expanded => {

            return ipc.invoke(desktopViewChannels.request, {
                type: "controller",
                expanded,
            });
        },
        subscribe: listener => {

            const handler = () => {

                listener();
            };
            ipc.on(desktopViewChannels.changed, handler);

            return () => {

                ipc.off(desktopViewChannels.changed, handler);
            };
        },
    };
}

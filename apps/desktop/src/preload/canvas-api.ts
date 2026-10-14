import type { CanvasChange, CanvasDocument, CanvasListing, CanvasReceipt, CanvasResult, CanvasServiceApi } from "../shared/canvas/contracts";
import { canvasServiceChannels, unwrapCanvasResult } from "../shared/canvas/contracts";
import type { DesktopView, DesktopViewsApi } from "../shared/canvas/views";
import { desktopViewChannels } from "../shared/canvas/views";
import { ipcRenderer } from "electron";

async function request(input: unknown) {

    return unwrapCanvasResult(await ipcRenderer.invoke(canvasServiceChannels.request, input) as CanvasResult);
}
export const canvases: CanvasServiceApi = {
    list: input => {

        return request({
            ...input,
            type: "list",
        }) as Promise<CanvasListing>;
    },
    read: canvasId => {

        return request({
            type: "read",
            canvasId,
        }) as Promise<CanvasDocument>;
    },
    create: (requestId, title) => {

        return request({
            type: "create",
            requestId,
            title,
        }) as Promise<CanvasReceipt>;
    },
    rename: (requestId, canvasId, expectedRevision, title) => {

        return request({
            type: "rename",
            requestId,
            canvasId,
            expectedRevision,
            title,
        }) as Promise<CanvasReceipt>;
    },
    apply: (requestId, canvasId, expectedRevision, operations) => {

        return request({
            type: "apply",
            requestId,
            canvasId,
            expectedRevision,
            operations,
        }) as Promise<CanvasReceipt>;
    },
    receipt: requestId => {

        return request({
            type: "receipt",
            requestId,
        }) as Promise<CanvasReceipt | null>;
    },
    subscribe: listener => {

        const handler = (_event: Electron.IpcRendererEvent, change: CanvasChange) => {

            listener(change);
        };
        ipcRenderer.on(canvasServiceChannels.changed, handler);

        return () => {

            ipcRenderer.off(canvasServiceChannels.changed, handler);
        };
    },
};
export const views: DesktopViewsApi = {
    inspect: () => {

        return ipcRenderer.invoke(desktopViewChannels.request, { type: "inspect" }) as Promise<DesktopView>;
    },
    list: () => {

        return ipcRenderer.invoke(desktopViewChannels.request, { type: "list" }) as Promise<readonly DesktopView[]>;
    },
    open: canvasId => {

        return ipcRenderer.invoke(desktopViewChannels.request, {
            type: "open",
            canvasId,
        }) as Promise<DesktopView>;
    },
    focus: viewId => {

        return ipcRenderer.invoke(desktopViewChannels.request, {
            type: "focus",
            viewId,
        }) as Promise<void>;
    },
    close: viewId => {

        return ipcRenderer.invoke(desktopViewChannels.request, {
            type: "close",
            viewId,
        }) as Promise<void>;
    },
    controller: expanded => {

        return ipcRenderer.invoke(desktopViewChannels.request, {
            type: "controller",
            expanded,
        }) as Promise<void>;
    },
    subscribe: listener => {

        const handler = () => {

            listener();
        };
        ipcRenderer.on(desktopViewChannels.changed, handler);

        return () => {

            ipcRenderer.off(desktopViewChannels.changed, handler);
        };
    },
};

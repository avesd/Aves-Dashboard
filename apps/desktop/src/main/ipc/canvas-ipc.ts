/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description Canvas IPC
 */

import { blockRuntimeRequestSchema, dashboardBlocksChannels } from "../../shared/canvas/blocks";
import { canvasServiceChannels } from "../../shared/canvas/contracts";
import { desktopViewChannels, viewRequestSchema } from "../../shared/canvas/views";
import type { DashboardBlockRuntime } from "../canvas/blocks/block-runtime";
import type { CanvasService } from "../canvas/canvas-service";
import { canvasFailure } from "../operation-failure";
import type { DesktopWindows } from "../windows/desktop-windows";
import { dispatchCommand } from "./dispatch-command";
import { handleWindow } from "./ipc-result";
import type { CommandHandlers, ViewRequest, ViewResults } from "@avesd/desktop-contracts/ipc-commands";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { IpcMain } from "electron";

interface CanvasServices {
    readonly windows: DesktopWindows | undefined;
    readonly canvasService: CanvasService | undefined;
    readonly blockRuntime: DashboardBlockRuntime | undefined;
}

export function registerCanvasIpc(ipc: Pick<IpcMain, "handle">, getServices: () => CanvasServices): void {

    handleWindow(ipc, canvasServiceChannels.request, async (event, input: unknown) => {

        const { windows, canvasService } = getServices();

        if (!windows || !canvasService) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Canvas service is unavailable.");
        }
        const view = windows.inspect(event);

        const result = await canvasService.execute({
            clientId: "desktop",
            canvasIds: view.canvasId ? [view.canvasId] : "all",
        }, input);
        if (!result.ok) {
            throw canvasFailure(result.error);
        }

        return result.value;
    });

    handleWindow(ipc, dashboardBlocksChannels.request, async (event, input: unknown) => {

        const { windows, blockRuntime } = getServices();

        if (!windows || !blockRuntime) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Dashboard blocks are unavailable.");
        }
        const view = windows.inspect(event);
        if (!view.canvasId) {
            throw new OperationError(IpcErrorCode.PermissionDenied, "Only a canvas frame can operate block leases.");
        }

        const result = await blockRuntime.invoke(event.sender, view.canvasId, blockRuntimeRequestSchema.parse(input));
        if (result && "error" in result && result.error) {
            throw new OperationError(result.error.code, result.error.message, result.error.currentRevision);
        }

        return result;
    });

    handleWindow(ipc, desktopViewChannels.request, async (event, input: unknown) => {

        const { windows } = getServices();

        if (!windows) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Desktop windows are unavailable.");
        }
        const source = windows.inspect(event);
        const request = viewRequestSchema.parse(input);
        if (source.canvasId && request.type !== "inspect" && request.type !== "controller"
            && (request.type !== "close" || request.viewId !== source.viewId)) {
            throw new OperationError(IpcErrorCode.PermissionDenied, "This view cannot control other windows.");
        }
        const handlers: CommandHandlers<ViewRequest, ViewResults> = {
            inspect: () => {

                return source;
            },
            controller: request => {

                windows.expand(request.expanded);
            },
            list: () => {

                return windows.list();
            },
            open: request => {

                return windows.open(request.canvasId);
            },
            focus: request => {

                windows.focus(request.viewId);
            },
            close: request => {

                windows.close(request.viewId);
            },
        };

        return dispatchCommand<ViewRequest, ViewResults>(request, handlers);
    });
}

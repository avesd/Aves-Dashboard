/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description Browser IPC
 */

import { browserControlsChannel, parseBrowserControls } from "../../shared/browser/browser-controls";
import { browserTaskCommandSchema, browserTasksChannel } from "../../shared/browser/browser-tasks";
import { parseWebCommand, settleWebSurfaceCommand, webSurfaceChannel } from "../../shared/browser/web-surface";
import type { BrowserBindings } from "../browser/browser-bindings";
import type { BrowserTasks } from "../browser/browser-tasks";
import type { WebSurfaceManager } from "../browser/web-surface-manager";
import type { WorkspaceFile } from "../storage/workspace-file";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import { sameDashboard } from "@avesd/workspace-model";
import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from "electron";

interface BrowserServices {
    readonly authorizeController: (event: IpcMainInvokeEvent) => void;
    readonly mainWindow: BrowserWindow | undefined;
    readonly webSurfaces: WebSurfaceManager | undefined;
    readonly browserBindings: BrowserBindings | undefined;
    readonly workspaceFile: WorkspaceFile | undefined;
    readonly browserTasks: BrowserTasks | undefined;
}

export function registerBrowserIpc(ipc: Pick<IpcMain, "handle">, getServices: () => BrowserServices): void {

    ipc.handle(webSurfaceChannel, (event, input: unknown) => {

        const { authorizeController, mainWindow, webSurfaces } = getServices();

        authorizeController(event);
        if (event.senderFrame !== mainWindow?.webContents.mainFrame || !webSurfaces) {
            throw new OperationError(IpcErrorCode.PermissionDenied, "Web commands require the host main frame.");
        }

        return settleWebSurfaceCommand(webSurfaces.command(parseWebCommand(input)));
    });

    ipc.handle(browserControlsChannel, async (event, input: unknown) => {

        const { authorizeController, mainWindow, webSurfaces, browserBindings, workspaceFile } = getServices();

        authorizeController(event);
        if (event.senderFrame !== mainWindow?.webContents.mainFrame || !browserBindings || !webSurfaces) {
            throw new OperationError(IpcErrorCode.PermissionDenied, "Browser controls require the host main frame.");
        }
        const command = parseBrowserControls(input);
        const snapshot = await workspaceFile?.load();
        if (!snapshot) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Workspace is unavailable.");
        }
        await browserBindings.prune(snapshot);
        switch (command.type) {
            case "list": return browserBindings.list(snapshot).filter((binding) => {

                return sameDashboard(binding, snapshot.selection);
            });
            case "bind":
                if (!snapshot.widgets.some((widget) => {

                    return widget.id === command.sourceId && sameDashboard(widget, snapshot.selection);
                })
            || !snapshot.widgets.some((widget) => {

                return widget.id === command.targetId && sameDashboard(widget, snapshot.selection);
            })) {
                    throw new OperationError(IpcErrorCode.InvalidArgument, "Browser bindings require the active dashboard.");
                }

                return browserBindings.bind(command, snapshot);
            case "unbind":
                if (!snapshot.widgets.some((widget) => {

                    return widget.id === command.sourceId && sameDashboard(widget, snapshot.selection);
                })) {
                    throw new OperationError(IpcErrorCode.InvalidArgument, "Browser bindings require the active dashboard.");
                }

                return browserBindings.unbind(command.sourceId, command.inputId);
            case "invoke": return webSurfaces.control(command, browserBindings);
        }
    });

    ipc.handle(browserTasksChannel, async (event, input: unknown) => {

        const { authorizeController, workspaceFile, browserTasks } = getServices();

        authorizeController(event);
        const workspaceId = (await workspaceFile?.load())?.selection?.workspaceId;
        if (!workspaceId || !browserTasks) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Background browsers are unavailable.");
        }

        return browserTasks.command(workspaceId, browserTaskCommandSchema.parse(input));
    });
}

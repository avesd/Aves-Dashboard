/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description Workspace IPC
 */

import type { AgentWorkbenchContext } from "../../shared/desktop-api";
import { agentIpcChannels, workspaceIpcChannels } from "../../shared/desktop-api";
import { workbenchPreferencesChannels } from "../../shared/workbench/preferences";
import { parseWidgetWorkspaceRequest, widgetWorkspaceChannels } from "../../shared/workspace/widget-workspace";
import { parseWorkspaceNavigation, workspaceNavigationChannel } from "../../shared/workspace/workspace-navigation";
import type { WorkspaceFile } from "../storage/workspace-file";
import type { WorkbenchPreferences } from "../workbench/preferences";
import type { AgentWorkbench } from "../workspace/agent-workbench";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { WidgetInstanceId } from "@avesd/workspace-model";
import type { WorkspaceSnapshot } from "@avesd/workspace-model";
import type { IpcMain, IpcMainInvokeEvent } from "electron";

interface WorkspaceServices {
    readonly authorizeController: (event: IpcMainInvokeEvent) => void;
    readonly workbench: AgentWorkbench | undefined;
    readonly workbenchPreferences: WorkbenchPreferences;
    readonly workspaceFile: WorkspaceFile | undefined;
}

export function registerWorkspaceIpc(ipc: Pick<IpcMain, "handle">, getServices: () => WorkspaceServices): void {

    ipc.handle(widgetWorkspaceChannels.renderer, (event, instanceId: unknown, input: unknown) => {

        const { authorizeController, workbench } = getServices();

        authorizeController(event);
        if (typeof instanceId !== "string" || !workbench) {
            throw new OperationError(IpcErrorCode.InvalidArgument, "Widget instance is required.");
        }

        return workbench.invokeWidget(instanceId as WidgetInstanceId, parseWidgetWorkspaceRequest(input));
    });

    ipc.handle(workspaceNavigationChannel, (event, input: unknown) => {

        const { authorizeController, workbench } = getServices();

        authorizeController(event);
        if (!workbench) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Workspace is unavailable.");
        }

        return workbench.navigate(parseWorkspaceNavigation(input));
    });

    ipc.handle(workbenchPreferencesChannels.sessionGet, event => {

        const { authorizeController, workbenchPreferences } = getServices();

        authorizeController(event);

        return workbenchPreferences.sessionPosition;
    });

    ipc.handle(workbenchPreferencesChannels.sessionSet, (event, position: unknown) => {

        const { authorizeController, workbenchPreferences } = getServices();

        authorizeController(event);

        return workbenchPreferences.setSessionPosition(position);
    });

    ipc.handle(workbenchPreferencesChannels.get, event => {

        const { authorizeController, workbenchPreferences } = getServices();

        authorizeController(event);

        return workbenchPreferences.side;
    });

    ipc.handle(workbenchPreferencesChannels.set, (event, side: unknown) => {

        const { authorizeController, workbenchPreferences } = getServices();

        authorizeController(event);

        return workbenchPreferences.setSide(side);
    });

    ipc.handle(agentIpcChannels.configureWorkbench, (event, context: unknown) => {

        const { authorizeController, workbench } = getServices();

        authorizeController(event);
        if (!context || typeof context !== "object") {
            throw new TypeError("Agent workbench context must be an object");
        }
        workbench?.configure(context as AgentWorkbenchContext);
    });

    ipc.handle(workspaceIpcChannels.load, (event) => {

        const { authorizeController, workspaceFile } = getServices();

        authorizeController(event);

        return workspaceFile?.load();
    });

    ipc.handle(workspaceIpcChannels.save, (event, snapshot: WorkspaceSnapshot, expected?: {
        snapshot: WorkspaceSnapshot | undefined;
    }) => {

        const { authorizeController, workbench } = getServices();

        authorizeController(event);
        if (!workbench) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Workspace storage is not ready");
        }

        return workbench.save(snapshot, expected);
    });
}

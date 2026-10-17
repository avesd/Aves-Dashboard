/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description Plugins IPC
 */

import { parseLocalWidgetCommand } from "../../shared/plugins/local-plugins";
import { localPluginsChannels } from "../../shared/plugins/local-plugins";
import type { LocalWidgetSurfaces } from "../plugins/local-widget-surfaces";
import type { AgentWorkbench } from "../workspace/agent-workbench";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { IpcMain, IpcMainInvokeEvent } from "electron";

interface PluginsServices {
    readonly authorizeController: (event: IpcMainInvokeEvent) => void;
    readonly workbench: AgentWorkbench | undefined;
    readonly localWidgetSurfaces: LocalWidgetSurfaces | undefined;
}

export function registerPluginsIpc(ipc: Pick<IpcMain, "handle">, getServices: () => PluginsServices): void {

    ipc.handle(localPluginsChannels.list, (event) => {

        const { authorizeController, workbench } = getServices();

        authorizeController(event);

        return workbench?.plugins.list() ?? [];
    });

    ipc.handle(localPluginsChannels.surface, (event, input: unknown) => {

        const { authorizeController, localWidgetSurfaces } = getServices();

        authorizeController(event);
        const command = parseLocalWidgetCommand(input);
        if (!localWidgetSurfaces) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Local widgets are not ready.");
        }

        return localWidgetSurfaces.command(command);
    });
}

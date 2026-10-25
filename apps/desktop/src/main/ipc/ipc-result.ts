/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description IPC Result
 */

import { operationFailure } from "../operation-failure";
import type { WindowResults } from "@avesd/desktop-contracts/ipc-commands";
import type { IpcResult } from "@avesd/desktop-contracts/ipc-result";
import type { IpcMain, IpcMainInvokeEvent } from "electron";

export async function captureIpcResult<T>(operation: () => T | Promise<T>): Promise<IpcResult<T>> {

    try {
        return {
            ok: true,
            value: await operation(),
        };
    }
    catch (error) {
        return {
            ok: false,
            error: operationFailure(error),
        };
    }
}

/** Register a current-window handler explicitly; compatibility handlers use ipc.handle. */
export function handleWindow<C extends keyof WindowResults>(
    ipc: Pick<IpcMain, "handle">,
    channel: C,
    handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => WindowResults[NoInfer<C>] | Promise<WindowResults[NoInfer<C>]>,
): void {

    ipc.handle(channel, (event, ...args: unknown[]) => {

        return captureIpcResult(() => {

            return handler(event, ...args);
        });
    });
}

/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description IPC Result
 */

import { operationFailure } from "../operation-failure";
import type { IpcResult } from "@avesd/desktop-contracts/ipc-result";
import type { IpcMain } from "electron";

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
export function handleWindow(ipc: Pick<IpcMain, "handle">, channel: string, handler: Parameters<IpcMain["handle"]>[1]): void {

    ipc.handle(channel, (event, ...args: unknown[]) => {

        return captureIpcResult(() => {

            return handler(event, ...args);
        });
    });
}

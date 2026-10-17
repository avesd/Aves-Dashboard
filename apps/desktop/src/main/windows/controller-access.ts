/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Windows
 * @description Controller Access
 */

import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";

/** Window identity is independent of Agent startup and connection state. */
export function assertControllerSender(event: IpcMainInvokeEvent, window: Pick<BrowserWindow, "webContents"> | undefined): void {

    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
        throw new OperationError(IpcErrorCode.PermissionDenied, "IPC request did not originate from the controller main frame.");
    }
}

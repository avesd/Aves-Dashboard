/**
 * @author Avesd
 * @package Desktop
 * @namespace Preload
 * @description Preload IPC
 */

import type { WindowWireInvoke } from "@avesd/desktop-contracts/ipc-commands";
import type { IpcRenderer } from "electron";

/** Electron transport stays inside preload; command results follow the shared request type. */
export type PreloadIpc = Pick<IpcRenderer, "on" | "off"> & {
    invoke: WindowWireInvoke;
};

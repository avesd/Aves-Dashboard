/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Preload
 */

import { createCanvasApi } from "./canvas-view-api";
import { createControllerApi } from "./controller-api";
import { contextBridge, ipcRenderer } from "electron";

if (process.isMainFrame) {

    if (process.argv.includes("--avesd-controller")) {
        contextBridge.exposeInMainWorld("avesdController", createControllerApi(ipcRenderer));
    } else if (process.argv.includes("--avesd-canvas")) {
        contextBridge.exposeInMainWorld("avesdCanvas", createCanvasApi(ipcRenderer));
    }
}

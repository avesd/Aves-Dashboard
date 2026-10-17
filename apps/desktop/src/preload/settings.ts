/**
 * @author Avesd
 * @package Desktop
 * @namespace Preload
 * @description Settings
 */

import type { WindowWireInvoke } from "@avesd/desktop-contracts/ipc-commands";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import type { SettingsApi } from "@avesd/desktop-contracts/settings";

// Keep this sandbox entry self-contained: shared runtime imports generate unsupported CJS chunks.
// Literal types still enforce agreement with the public channel contract.
const settingsChannels: typeof import("@avesd/desktop-contracts/settings").settingsChannels = {
    open: "settings:open",
    command: "settings:command",
    changed: "settings:changed",
};

import { contextBridge, ipcRenderer } from "electron";

const invoke: WindowWireInvoke = ipcRenderer.invoke.bind(ipcRenderer);

const api: WireApi<SettingsApi> = {
    providers: {
        list: () => {

            return invoke(settingsChannels.command, { type: "providers" });
        },
        openSetup: id => {

            return invoke(settingsChannels.command, {
                type: "setup",
                id,
            });
        },
    },
    read: () => {

        return invoke(settingsChannels.command, { type: "read" });
    },
    configure: (routes, revision) => {

        return invoke(settingsChannels.command, {
            type: "configure",
            routes,
            revision,
        });
    },
    probeRoute: (route, test) => {

        return invoke(settingsChannels.command, {
            type: "probe",
            route,
            test,
        });
    },
    subscribe: listener => {

        const receive = () => {

            return void listener();
        };
        ipcRenderer.on(settingsChannels.changed, receive);

        return () => {

            ipcRenderer.off(settingsChannels.changed, receive);
        };
    },
};
if (process.isMainFrame) {
    contextBridge.exposeInMainWorld("avesdSettings", api);
}

/**
 * @author Avesd
 * @package Desktop
 * @namespace Preload
 * @description Settings Launcher API
 */

import type { PreloadIpc } from "./preload-ipc";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import { settingsChannels } from "@avesd/desktop-contracts/settings";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";

export function createSettingsLauncherApi(ipc: PreloadIpc): WireApi<ControllerApi>["settings"] {

    return {
        open: () => {

            return ipc.invoke(settingsChannels.open);
        },
        subscribe: (listener: () => void) => {

            const receive = () => {

                return void listener();
            };
            ipc.on(settingsChannels.changed, receive);

            return () => {

                ipc.off(settingsChannels.changed, receive);
            };
        },
    };
}

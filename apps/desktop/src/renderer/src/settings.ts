/**
 * @author Avesd
 * @package Desktop
 * @namespace Renderer_Src
 * @description Settings
 */

import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import { createWindowClient } from "@avesd/desktop-contracts/ipc-result";
import type { SettingsApi } from "@avesd/desktop-contracts/settings";
import { mountSettings } from "@avesd/renderer-settings/entry";

declare global {
    interface Window {
        readonly avesdSettings?: WireApi<SettingsApi>;
    }
}
const root = document.getElementById("root");
if (!root) {
    throw new Error("Settings root is unavailable.");
}
mountSettings(root, window.avesdSettings ? createWindowClient<SettingsApi>(window.avesdSettings) : undefined);

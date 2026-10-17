/**
 * @author Avesd
 * @package Desktop
 * @namespace Preload
 * @description Controller API
 */

import { createAgentProvidersApi, createAgentSessionsApi } from "./agent-api";
import { createCanvasClient, createViewsClient } from "./canvas-api";
import type { PreloadIpc } from "./preload-ipc";
import { createSettingsLauncherApi } from "./settings-launcher-api";
import { createVoiceApi } from "./voice-api";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";

/** Compose only the capabilities available to the native controller. */
export function createControllerApi(ipc: PreloadIpc): WireApi<ControllerApi> {

    const canvases = createCanvasClient(ipc);

    return {
        agentSessions: createAgentSessionsApi(ipc),
        agentProviders: createAgentProvidersApi(ipc),
        canvases: {
            list: canvases.list,
            subscribe: canvases.subscribe,
        },
        views: createViewsClient(ipc),
        voice: createVoiceApi(ipc),
        settings: createSettingsLauncherApi(ipc),
    };
}

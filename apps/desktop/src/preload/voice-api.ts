/**
 * @author Avesd
 * @package Desktop
 * @namespace Preload
 * @description Voice API
 */

import type { LiveVoiceApi } from "../shared/voice/live";
import { liveChannels } from "../shared/voice/live";
import type { PreloadIpc } from "./preload-ipc";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";

export function createVoiceApi(ipc: PreloadIpc): WireApi<LiveVoiceApi> {

    return {
        availability: () => {

            return ipc.invoke(liveChannels.command, { type: "availability" });
        },
        start: (connectionId, agentId, sdp) => {

            return ipc.invoke(liveChannels.command, {
                type: "start",
                connectionId,
                agentId,
                sdp,
            });
        },
        event: (connectionId, event) => {

            return ipc.invoke(liveChannels.command, {
                type: "event",
                connectionId,
                event,
            });
        },
        stop: connectionId => {

            return ipc.invoke(liveChannels.command, {
                type: "stop",
                connectionId,
            });
        },
        cancelTask: connectionId => {

            return ipc.invoke(liveChannels.command, {
                type: "cancelTask",
                connectionId,
            });
        },
        subscribe: listener => {

            const receive = (_event: Electron.IpcRendererEvent, value: Parameters<typeof listener>[0]) => {

                return void listener(value);
            };
            ipc.on(liveChannels.event, receive);

            return () => {

                ipc.off(liveChannels.event, receive);
            };
        },
    };
}

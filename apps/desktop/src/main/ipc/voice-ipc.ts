/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description Voice IPC
 */

import { liveChannels, liveRequestSchema } from "../../shared/voice/live";
import type { LiveVoice } from "../voice/live-voice";
import { dispatchCommand } from "./dispatch-command";
import { handleWindow } from "./ipc-result";
import type { CommandHandlers, LiveRequest, LiveResults } from "@avesd/desktop-contracts/ipc-commands";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { IpcMain, IpcMainInvokeEvent } from "electron";

interface VoiceServices {
    readonly authorizeController: (event: IpcMainInvokeEvent) => void;
    readonly voice: LiveVoice | undefined;
}

export function registerVoiceIpc(ipc: Pick<IpcMain, "handle">, getServices: () => VoiceServices): void {

    handleWindow(ipc, liveChannels.command, (event, input: unknown) => {

        const { authorizeController, voice } = getServices();

        authorizeController(event);
        if (!voice) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Voice is not ready.");
        }
        const request = liveRequestSchema.parse(input);
        const handlers: CommandHandlers<LiveRequest, LiveResults> = {
            availability: () => {

                return voice.availability();
            },
            start: request => {

                return voice.start(request.connectionId, request.agentId, request.sdp);
            },
            event: request => {

                voice.event(request.connectionId, request.event);
            },
            stop: request => {

                voice.stop(request.connectionId);
            },
            cancelTask: request => {

                return voice.cancelTask(request.connectionId);
            },
        };

        return dispatchCommand<LiveRequest, LiveResults>(request, handlers);
    });
}

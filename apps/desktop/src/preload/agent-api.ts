/**
 * @author Avesd
 * @package Desktop
 * @namespace Preload
 * @description Agent API
 */

import { agentProvidersChannels } from "../shared/agent/providers";
import type { AgentSessionsChange, AgentTierRoute } from "../shared/agent/sessions";
import { agentSessionsChannels } from "../shared/agent/sessions";
import type { PreloadIpc } from "./preload-ipc";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import type { AgentTier } from "@avesd/plugin-api";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";

export function createAgentSessionsApi(ipc: PreloadIpc): WireApi<ControllerApi>["agentSessions"] {

    return {
        configureFlagship: (route: AgentTierRoute) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "configureFlagship",
                route,
            });
        },
        probeRoute: (route: AgentTierRoute, test: boolean) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "probeRoute",
                route,
                test,
            });
        },
        list: () => {

            return ipc.invoke(agentSessionsChannels.command, { type: "list" });
        },
        create: (tier: AgentTier, route?: AgentTierRoute) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "create",
                tier,
                ...(route ? { route } : {}),
            });
        },
        select: (id: string) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "select",
                id,
            });
        },
        read: (id: string) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "read",
                id,
            });
        },
        connect: (id: string) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "connect",
                id,
            });
        },
        configureSession: (id: string, route: AgentTierRoute) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "configureSession",
                id,
                route,
            });
        },
        prompt: (id: string, text: string) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "prompt",
                id,
                text,
            });
        },
        enqueue: (id: string, text: string) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "enqueue",
                id,
                text,
            });
        },
        cancelTurn: (id: string) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "cancelTurn",
                id,
            });
        },
        remove: (id: string) => {

            return ipc.invoke(agentSessionsChannels.command, {
                type: "remove",
                id,
            });
        },
        routes: () => {

            return ipc.invoke(agentSessionsChannels.command, { type: "routes" });
        },
        subscribe: (listener: (change: AgentSessionsChange) => void) => {

            const receive = (_event: Electron.IpcRendererEvent, change: AgentSessionsChange) => {

                listener(change);
            };
            ipc.on(agentSessionsChannels.changed, receive);

            return () => {

                ipc.off(agentSessionsChannels.changed, receive);
            };
        },
    };
}

export function createAgentProvidersApi(ipc: PreloadIpc): WireApi<ControllerApi>["agentProviders"] {

    return {
        availability: () => {

            return ipc.invoke(agentProvidersChannels.availability);
        },
        list: (refresh = false) => {

            return ipc.invoke(agentProvidersChannels.list, refresh);
        },
    };
}

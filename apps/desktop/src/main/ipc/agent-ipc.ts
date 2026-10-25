/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description Agent IPC
 */

import { agentProvidersChannels } from "../../shared/agent/providers";
import { agentSessionsChannels } from "../../shared/agent/sessions";
import { agentIpcChannels, parseAgentPrompt } from "../../shared/desktop-api";
import type { AgentPreferences } from "../agent/agent-preferences";
import type { AgentTaskBridge } from "../agent/agent-task-bridge";
import { deepSeekAvailability, deepSeekProviders, probeDeepSeek, requireDeepSeek } from "../agent/deepseek-provider";
import type { AgentSessions } from "../agent/sessions/agent-sessions";
import type { ApiKeyService } from "../credentials/api-key-service";
import { dispatchCommand } from "./dispatch-command";
import { handleWindow } from "./ipc-result";
import type { AgentSessionCommand, AgentSessionResults, CommandHandlers } from "@avesd/desktop-contracts/ipc-commands";
import { agentSessionCommandSchema } from "@avesd/desktop-contracts/ipc-commands";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { IpcMain, IpcMainInvokeEvent } from "electron";

interface AgentServices {
    readonly apiKeys: ApiKeyService | undefined;
    readonly authorizeController: (event: IpcMainInvokeEvent) => void;
    readonly getAgentSessions: () => AgentSessions;
    readonly agentPreferences: AgentPreferences;
    readonly agentTaskBridge: AgentTaskBridge;
    readonly openExternal: (url: string) => Promise<void>;
}

export function registerAgentIpc(ipc: Pick<IpcMain, "handle">, getServices: () => AgentServices): void {

    handleWindow(ipc, agentProvidersChannels.availability, event => {

        getServices().authorizeController(event);

        return deepSeekAvailability(() => {

            return getServices().apiKeys?.key("deepseek");
        });
    });

    handleWindow(ipc, agentProvidersChannels.list, (event) => {

        const { authorizeController } = getServices();

        authorizeController(event);

        return deepSeekProviders(() => {

            return getServices().apiKeys?.key("deepseek");
        });
    });

    ipc.handle(agentProvidersChannels.configure, (event) => {

        const { authorizeController } = getServices();

        authorizeController(event);
        throw new OperationError(IpcErrorCode.InvalidArgument, "Configure DeepSeek through the local environment file and restart Avesd.");
    });

    ipc.handle(agentProvidersChannels.setup, (event, id: unknown) => {

        const { authorizeController, openExternal } = getServices();

        authorizeController(event);
        requireDeepSeek(id);

        return openExternal("https://api-docs.deepseek.com/");
    });

    handleWindow(ipc, agentSessionsChannels.command, async (event, input: unknown) => {

        const { authorizeController, agentPreferences, getAgentSessions } = getServices();

        authorizeController(event);
        const request = agentSessionCommandSchema.parse(input);
        const handlers: CommandHandlers<AgentSessionCommand, AgentSessionResults> = {
            list: () => {

                return getAgentSessions().list();
            },
            create: request => {

                if (request.route) {
                    requireDeepSeek(request.route.providerId);
                }

                return getAgentSessions().create(request.tier, undefined, request.route);
            },
            routes: () => {

                return agentPreferences.routes;
            },
            configureFlagship: request => {

                requireDeepSeek(request.route.providerId);

                return agentPreferences.configureFlagship(request.route);
            },
            configure: request => {

                for (const route of Object.values(request.routes)) {
                    requireDeepSeek(route.providerId);
                }

                return agentPreferences.configureRoutes(request.routes);
            },
            probeRoute: request => {

                requireDeepSeek(request.route.providerId);

                return probeDeepSeek(request.route, request.test, () => {

                    return getServices().apiKeys?.key("deepseek");
                });
            },
            read: request => {

                return getAgentSessions().snapshot(request.id);
            },
            select: request => {

                return void getAgentSessions().select(request.id);
            },
            connect: request => {

                return getAgentSessions().connect(request.id);
            },
            configureSession: request => {

                requireDeepSeek(request.route.providerId);

                return getAgentSessions().configureSession(request.id, request.route);
            },
            prompt: request => {

                return getAgentSessions().prompt(request.text, request.id);
            },
            enqueue: request => {

                return getAgentSessions().enqueue(request.text, request.id);
            },
            cancelTurn: request => {

                return getAgentSessions().cancelTurn(request.id);
            },
            cancel: request => {

                return getAgentSessions().cancel(request.id);
            },
            remove: request => {

                return getAgentSessions().remove(request.id);
            },
        };

        return dispatchCommand<AgentSessionCommand, AgentSessionResults>(request, handlers);
    });

    ipc.handle("widget-agent:renderer", (event, widgetId: unknown, input: unknown) => {

        const { authorizeController, agentTaskBridge } = getServices();

        authorizeController(event);
        if (typeof widgetId !== "string" || widgetId.length > 128) {
            throw new OperationError(IpcErrorCode.InvalidArgument, "Invalid widget ID.");
        }

        return agentTaskBridge.invoke(widgetId, input);
    });

    ipc.handle(agentIpcChannels.settings, event => {

        const { authorizeController, getAgentSessions } = getServices();

        authorizeController(event);

        return getAgentSessions().getSettings();
    });

    ipc.handle(agentIpcChannels.provider, (event, id: unknown) => {

        const { authorizeController, getAgentSessions } = getServices();

        if (typeof id !== "string" || id.length > 64) {
            throw new OperationError(IpcErrorCode.InvalidArgument, "Invalid provider.");
        }

        authorizeController(event);

        return getAgentSessions().selectProvider(id);
    });

    ipc.handle(agentIpcChannels.model, (event, id: unknown) => {

        const { authorizeController, getAgentSessions } = getServices();

        if (typeof id !== "string" || id.length > 512) {
            throw new OperationError(IpcErrorCode.InvalidArgument, "Invalid model.");
        }

        authorizeController(event);

        return getAgentSessions().selectModel(id);
    });

    ipc.handle(agentIpcChannels.connect, (event) => {

        const { authorizeController, getAgentSessions } = getServices();

        authorizeController(event);

        return getAgentSessions().connect();
    });

    ipc.handle(agentIpcChannels.effort, (event, id: unknown) => {

        const { authorizeController, getAgentSessions } = getServices();

        if (typeof id !== "string" || id.length > 512) {
            throw new OperationError(IpcErrorCode.InvalidArgument, "Invalid reasoning effort.");
        }

        authorizeController(event);

        return getAgentSessions().selectEffort(id);
    });

    ipc.handle(agentIpcChannels.prompt, (event, input: unknown) =>
    {

        const { authorizeController, getAgentSessions } = getServices();

        authorizeController(event);

        return getAgentSessions().prompt(parseAgentPrompt(input));
    });

    ipc.handle(agentIpcChannels.cancel, (event) => {

        const { authorizeController, getAgentSessions } = getServices();

        authorizeController(event);

        return getAgentSessions().cancel();
    });
}

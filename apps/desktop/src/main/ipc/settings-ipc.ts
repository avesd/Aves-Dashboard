/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description Settings IPC
 */

import type { AgentPreferences } from "../agent/agent-preferences";
import { deepSeekAvailability, deepSeekProviders, probeDeepSeek, requireDeepSeek } from "../agent/deepseek-provider";
import type { ApiKeyService } from "../credentials/api-key-service";
import type { SettingsWindow } from "../windows/settings-window";
import { dispatchCommand } from "./dispatch-command";
import { handleWindow } from "./ipc-result";
import type { CommandHandlers, SettingsCommand, SettingsResults } from "@avesd/desktop-contracts/ipc-commands";
import { settingsCommandSchema } from "@avesd/desktop-contracts/ipc-commands";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import { settingsChannels } from "@avesd/desktop-contracts/settings";
import type { IpcMain, IpcMainInvokeEvent } from "electron";

interface SettingsServices {
    readonly apiKeys: ApiKeyService | undefined;
    readonly authorizeController: (event: IpcMainInvokeEvent) => void;
    readonly settingsWindow: SettingsWindow | undefined;
    readonly agentPreferences: AgentPreferences;
    readonly openExternal: (url: string) => Promise<void>;
}

export function registerSettingsIpc(ipc: Pick<IpcMain, "handle">, getServices: () => SettingsServices): void {

    handleWindow(ipc, settingsChannels.open, event => {

        const { authorizeController, settingsWindow } = getServices();

        authorizeController(event);
        if (!settingsWindow) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Settings are not ready.");
        }
        settingsWindow.open();
    });

    handleWindow(ipc, settingsChannels.command, async (event, input: unknown) => {

        const { settingsWindow, agentPreferences, openExternal, apiKeys } = getServices();

        if (!settingsWindow) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Settings are not ready.");
        }
        settingsWindow.authorize(event);
        const request = settingsCommandSchema.parse(input);
        const credentials = () => {

            if (!apiKeys) {
                throw new OperationError(IpcErrorCode.ServiceNotReady, "API key settings are not ready.");
            }

            return apiKeys;
        };
        const authorize = () => {

            settingsWindow.authorize(event);
        };
        const handlers: CommandHandlers<SettingsCommand, SettingsResults> = {
            apiKeys: () => {

                return credentials().snapshot();
            },
            saveApiKey: request => {

                return credentials().save(request.id, request.key, request.revision, authorize);
            },
            removeApiKey: request => {

                return void credentials().remove(request.id, request.revision, authorize);
            },
            testApiKey: request => {

                return credentials().test(request.id, request.revision, authorize);
            },
            read: () => {

                return {
                    routes: agentPreferences.routes,
                    revision: agentPreferences.revision,
                };
            },
            providers: () => {

                return deepSeekProviders(() => {

                    return getServices().apiKeys?.key("deepseek");
                });
            },
            providerAvailability: () => {

                return deepSeekAvailability(() => {

                    return getServices().apiKeys?.key("deepseek");
                });
            },
            setup: request => {

                requireDeepSeek(request.id);

                return openExternal("https://api-docs.deepseek.com/");
            },
            probe: request => {

                requireDeepSeek(request.route.providerId);

                return probeDeepSeek(request.route, request.test, () => {

                    return getServices().apiKeys?.key("deepseek");
                });
            },
            configure: request => {

                for (const route of Object.values(request.routes)) {
                    requireDeepSeek(route.providerId);
                }

                return agentPreferences.configureRoutes(request.routes, request.revision);
            },
        };

        return dispatchCommand<SettingsCommand, SettingsResults>(request, handlers);
    });
}

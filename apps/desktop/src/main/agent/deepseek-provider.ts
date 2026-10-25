/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Agent
 * @description Deepseek Provider
 */

import type { AgentProviderAvailability, AgentProviderInstallation } from "../../shared/agent/providers";
import type { AgentRouteProbeResult, AgentTierRoute } from "../../shared/agent/sessions";
import { DeepSeekAgentHost, defaultDeepSeekModel } from "./deepseek-agent-host";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";

export function requireDeepSeek(id: unknown): void {

    if (id !== "deepseek") {
        throw new OperationError(IpcErrorCode.InvalidArgument, "Only the direct DeepSeek provider is enabled.");
    }
}
export async function deepSeekAvailability(key: () => string | undefined | Promise<string | undefined>): Promise<readonly AgentProviderAvailability[]> {

    let readiness: AgentProviderAvailability["readiness"];
    try {
        readiness = (await key())?.trim() ? "configured" : "missing";
    } catch {
        readiness = "unavailable";
    }

    return [
        {
            id: "deepseek",
            name: "DeepSeek",
            enabled: true,
            kind: "api",
            readiness,
            setupUrl: "https://api-docs.deepseek.com/",
            message: readiness === "configured" ? "API key configured. Use Check access to verify a request." : "Add or unlock the DeepSeek API key in Settings → Models & services.",
        },
    ];
}

/** Retained executable-installation wire shape for compatibility callers. */
export async function deepSeekProviders(key: () => string | undefined | Promise<string | undefined>): Promise<readonly AgentProviderInstallation[]> {

    return (await deepSeekAvailability(key)).map(provider => {

        return {
            id: provider.id,
            name: provider.name,
            enabled: provider.enabled,
            executablePath: "",
            status: provider.readiness === "configured" ? "installed" : "not-found",
            source: "api",
            bundledAvailable: false,
            loginCommand: "",
            setupUrl: provider.setupUrl,
            message: provider.message,
        };
    });
}
export async function probeDeepSeek(route: AgentTierRoute, test: boolean, key: () => string | undefined | Promise<string | undefined>): Promise<AgentRouteProbeResult> {

    requireDeepSeek(route.providerId);
    const model = route.modelId || defaultDeepSeekModel();
    if (!/^[a-zA-Z0-9._-]{1,128}$/u.test(model) || route.effortId) {
        return {
            ok: false,
            message: "Choose a DeepSeek model with default effort.",
        };
    }
    if (test) {
        const host = new DeepSeekAgentHost({
            model,
            key,
            authorize: () => {

                return () => {

                    return true;
                };
            },
            invoke: async () => {

                throw new Error("No tools in connection checks.");
            },
        });
        try {
            await host.prompt("Reply with OK.", "probe");
        }
        catch {
            return {
                ok: false,
                message: "DeepSeek request failed. Check API key, model access, quota and network.",
            };
        }
        finally {
            host.dispose();
        }
    }

    return {
        ok: true,
        tested: test,
        options: {
            models: [
                ...new Set([
                    defaultDeepSeekModel(),
                    model,
                    "deepseek-flash",
                    "deepseek-v4-pro",
                ]),
            ].map(id => {

                return {
                    id,
                    name: id,
                };
            }),
            efforts: [],
            defaultModelId: defaultDeepSeekModel(),
            modelId: model,
        },
    };
}

/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Agent
 * @description Deepseek Provider
 */

import type { AgentProviderInstallation } from "../../shared/agent/providers";
import type { AgentRouteProbeResult, AgentTierRoute } from "../../shared/agent/sessions";
import { DeepSeekAgentHost, defaultDeepSeekModel } from "./deepseek-agent-host";

export function requireDeepSeek(id: unknown): void {

    if (id !== "deepseek") {
        throw new Error("Only the direct DeepSeek provider is enabled.");
    }
}
export function deepSeekProviders(): readonly AgentProviderInstallation[] {

    const configured = !!process.env.DEEPSEEK_API_KEY?.trim();

    return [
        {
            id: "deepseek",
            name: "DeepSeek",
            enabled: true,
            executablePath: "",
            status: configured ? "installed" : "not-found",
            source: "api",
            bundledAvailable: false,
            loginCommand: "",
            setupUrl: "https://api-docs.deepseek.com/",
            message: configured ? "API key configured. Use Check access to verify a request." : "Set DEEPSEEK_API_KEY in env/.env.development.local and restart Avesd.",
        },
    ];
}
export async function probeDeepSeek(route: AgentTierRoute, test: boolean): Promise<AgentRouteProbeResult> {

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

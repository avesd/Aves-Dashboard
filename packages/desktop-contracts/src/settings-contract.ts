/**
 * @author Avesd
 * @package Desktop Contracts
 * @namespace Root
 * @description Settings Contract
 */

import type { AgentTier } from "@avesd/plugin-api";

export const AGENT_TIERS = [
    "flagship",
    "reasoning",
    "action",
] as const;
export const agentTierLabels: Record<AgentTier, string> = {
    flagship: "Flagship",
    reasoning: "Reasoning",
    action: "Action",
};
export interface AgentTierRoute {
    readonly providerId: string;
    readonly modelId: string;
    readonly effortId: string;
}
export type AgentTierRoutes = Readonly<Record<AgentTier, AgentTierRoute>>;
export interface AgentRouteOptions {
    readonly models: readonly {
        readonly id: string;
        readonly name: string;
    }[];
    readonly efforts: readonly {
        readonly id: string;
        readonly name: string;
    }[];
    readonly defaultModelId?: string;
    readonly defaultEffortId?: string;
    readonly modelId?: string;
    readonly effortId?: string;
}
export type AgentRouteProbeResult = {
    readonly ok: true;
    readonly options: AgentRouteOptions;
    readonly tested: boolean;
} | {
    readonly ok: false;
    readonly message: string;
};
export type AgentProviderId = string;
export interface AgentProviderConfiguration {
    readonly enabled: boolean;
    readonly executablePath: string;
}
export interface AgentProviderInstallation extends AgentProviderConfiguration {
    readonly id: string;
    readonly name: string;
    readonly status: "checking" | "installed" | "not-found" | "error";
    readonly source: "bundled" | "system" | "custom" | "api";
    readonly bundledAvailable: boolean;
    readonly resolvedPath?: string;
    readonly version?: string;
    readonly message?: string;
    readonly loginCommand: string;
    readonly setupUrl?: string;
}
export interface AgentProvidersApi {
    list(refresh?: boolean): Promise<readonly AgentProviderInstallation[]>;
    configure(id: AgentProviderId, configuration: AgentProviderConfiguration): Promise<void>;
    openSetup(id: AgentProviderId): Promise<void>;
}
export const agentProvidersChannels = {
    list: "agent-providers:list",
    configure: "agent-providers:configure",
    setup: "agent-providers:setup",
} as const;

export interface SettingsSnapshot {
    readonly revision: number;
    readonly routes: AgentTierRoutes;
}
export const API_KEY_PROVIDERS = [
    "deepseek",
    "openai",
] as const;
export type ApiKeyProvider = typeof API_KEY_PROVIDERS[number];
export interface ApiKeyStatus {
    readonly id: ApiKeyProvider;
    readonly revision: number;
    readonly source: "saved" | "missing" | "unavailable";
    readonly hasSavedKey: boolean;
    readonly message?: string;
}
export interface ApiKeySnapshot {
    readonly secureStorageAvailable: boolean;
    readonly providers: readonly ApiKeyStatus[];
}
export interface ApiKeyTestResult {
    readonly ok: boolean;
    readonly message: string;
}
export interface ApiKeysApi {
    read(): Promise<ApiKeySnapshot>;
    save(id: ApiKeyProvider, key: string, revision: number): Promise<void>;
    remove(id: ApiKeyProvider, revision: number): Promise<void>;
    test(id: ApiKeyProvider, revision: number): Promise<ApiKeyTestResult>;
}

export interface SettingsApi {
    readonly apiKeys: ApiKeysApi;
    readonly providers: Pick<AgentProvidersApi, "list" | "openSetup">;
    read(): Promise<SettingsSnapshot>;
    configure(routes: AgentTierRoutes, revision: number): Promise<void>;
    probeRoute(route: AgentTierRoute, test: boolean): Promise<AgentRouteProbeResult>;
    subscribe(listener: () => void): () => void;
}
export const settingsChannels = {
    open: "settings:open",
    command: "settings:command",
    changed: "settings:changed",
} as const;

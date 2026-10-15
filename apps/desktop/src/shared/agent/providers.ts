/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Providers
 */

import type { AcpProviderConfiguration, AcpProviderId, AcpProviderInstallation } from "@avesd/acp-management";

export type AgentProviderId = AcpProviderId;
export type AgentProviderConfiguration = AcpProviderConfiguration;
export type AgentProviderInstallation = AcpProviderInstallation;
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

/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Unified agent session administration and tier routing
 */

import type { AcpModelOptions, AcpModelProbeResult, AcpSelection } from "@avesd/acp-management";
import { parseAcpSelection } from "@avesd/acp-management";
import type { AgentEvent, AgentSettings, AgentTaskRequest, AgentTaskStatus, AgentTier } from "@avesd/plugin-api";
import type { DashboardScope } from "@avesd/workspace-model";

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
export type AgentTierRoute = AcpSelection;
export type AgentTierRoutes = Readonly<Record<AgentTier, AgentTierRoute>>;
export type AgentRouteOptions = AcpModelOptions;
export type AgentRouteProbeResult = AcpModelProbeResult;
export interface AgentSessionSummary extends DashboardScope {
    readonly waitingForAnswer?: boolean;
    readonly route: AgentTierRoute;
    readonly id: string;
    readonly tier: AgentTier;
    readonly kind: "interactive" | "background";
    readonly source: string;
    readonly status: AgentTaskStatus;
    readonly createdAt: number;
}
export interface AgentSessionSnapshot extends AgentSessionSummary {
    readonly events: readonly {
        readonly sequence: number;
        readonly event: AgentEvent;
    }[];
    readonly settings?: AgentSettings;
}
export type AgentSessionsChange = {
    readonly type: "updated" | "removed" | "selectionChanged";
    readonly id: string;
};
export interface AgentSessionsApi {
    list(): Promise<{
        readonly selectedId?: string;
        readonly sessions: readonly AgentSessionSummary[];
    }>;
    create(tier: AgentTier, route?: AgentTierRoute): Promise<{
        readonly id: string;
    }>;
    select(id: string): Promise<void>;
    read(id: string): Promise<AgentSessionSnapshot | null>;
    connect(id: string): Promise<void>;
    configureSession(id: string, route: AgentTierRoute): Promise<void>;
    prompt(id: string, text: string): Promise<void>;
    cancel(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    routes(): Promise<AgentTierRoutes>;
    configure(routes: AgentTierRoutes): Promise<void>;
    probeRoute(route: AgentTierRoute, test: boolean): Promise<AgentRouteProbeResult>;
    subscribe(listener: (change: AgentSessionsChange) => void): () => void;
}
export const agentSessionsChannels = {
    command: "agent-sessions:command",
    changed: "agent-sessions:changed",
} as const;
export function parseAgentTier(value: unknown): AgentTier {

    if (!AGENT_TIERS.includes(value as AgentTier)) {
        throw new Error("Choose Flagship, Reasoning or Action.");
    }

    return value as AgentTier;
}
export function parseAgentTask(input: unknown): AgentTaskRequest {

    if (!input || typeof input !== "object" || !("tier" in input) || !("prompt" in input)
        || typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 32000) {
        throw new Error("Use a nonempty prompt of at most 32000 characters.");
    }

    return {
        tier: parseAgentTier(input.tier),
        prompt: input.prompt.trim(),
    };
}
export function parseAgentRoutes(input: unknown): AgentTierRoutes {

    if (!input || typeof input !== "object") {
        throw new Error("Invalid agent tier settings.");
    }

    return Object.fromEntries(AGENT_TIERS.map(tier => {

        return [
            tier,
            parseAgentRoute((input as Record<string, unknown>)[tier]),
        ];
    })) as unknown as AgentTierRoutes;
}

export function parseAgentRoute(input: unknown): AgentTierRoute {

    return parseAcpSelection(input);
}

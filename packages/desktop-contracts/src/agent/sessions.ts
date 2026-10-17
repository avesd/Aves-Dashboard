/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Unified agent session administration and tier routing
 */

import { agentRouteSchema, agentRoutesSchema } from "../ipc-commands";
import type { AgentRouteProbeResult, AgentTierRoute, AgentTierRoutes } from "../settings-contract";
import { AGENT_TIERS } from "../settings-contract";
import type { AgentEvent, AgentSettings, AgentTaskRequest, AgentTaskStatus, AgentTier } from "@avesd/plugin-api";
import type { DashboardScope } from "@avesd/workspace-model";

export type { AgentRouteOptions, AgentRouteProbeResult, AgentTierRoute, AgentTierRoutes } from "../settings-contract";
export { AGENT_TIERS, agentTierLabels } from "../settings-contract";
export interface AgentSessionSummary extends DashboardScope {
    readonly execution?: {
        readonly id: string;
        readonly status: "running" | "cancelling" | "cancelled" | "completed" | "error";
    };
    readonly connectionReset?: boolean;
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
    readonly queuedPrompts: readonly {
        readonly id: string;
        readonly text: string;
    }[];
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
    enqueue(id: string, text: string): Promise<{
        id: string;
    }>;
    cancelTurn(id: string): Promise<void>;
    cancel(id: string): Promise<void>;
    remove(id: string): Promise<void>;
    routes(): Promise<AgentTierRoutes>;
    configure(routes: AgentTierRoutes): Promise<void>;
    configureFlagship(route: AgentTierRoute): Promise<void>;
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

    return agentRoutesSchema.parse(input);
}
export function parseAgentRoute(input: unknown): AgentTierRoute {

    return agentRouteSchema.parse(input);
}

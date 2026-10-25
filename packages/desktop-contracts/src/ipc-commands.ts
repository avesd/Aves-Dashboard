/**
 * @author Avesd
 * @package Desktop Contracts
 * @namespace Root
 * @description IPC Commands
 */

import type { AgentSessionsApi } from "./agent/sessions";
import type { BlockResults, BlockRuntimeRequest } from "./canvas/blocks";
import type { CanvasDocument, CanvasListing, CanvasReceipt, CanvasRequest } from "./canvas/contracts";
import type { DesktopView, viewRequestSchema } from "./canvas/views";
import type { IpcResult } from "./ipc-result";
import type { AgentProvidersApi, SettingsApi } from "./settings-contract";
import { AGENT_TIERS, API_KEY_PROVIDERS } from "./settings-contract";
import type { liveRequestSchema, LiveVoiceApi } from "./voice/live";
import * as z from "zod";

export const agentRouteSchema = z.strictObject({
    providerId: z.string().max(512),
    modelId: z.string().max(512)
        .transform(value => {

            return value.trim();
        }),
    effortId: z.string().max(512)
        .transform(value => {

            return value.trim();
        }),
});
export const agentRoutesSchema = z.strictObject({
    flagship: agentRouteSchema,
    reasoning: agentRouteSchema,
    action: agentRouteSchema,
});
export const agentPromptSchema = z.string().transform(value => {

    return value.trim();
})
    .pipe(z.string().min(1)
        .max(32768));
const sessionId = z.string().min(1)
    .max(128);
export const agentSessionCommandSchema = z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("list") }),
    z.strictObject({
        type: z.literal("create"),
        tier: z.enum(AGENT_TIERS),
        route: agentRouteSchema.optional(),
    }),
    z.strictObject({ type: z.literal("routes") }),
    z.strictObject({
        type: z.literal("configure"),
        routes: agentRoutesSchema,
    }),
    z.strictObject({
        type: z.literal("configureFlagship"),
        route: agentRouteSchema,
    }),
    z.strictObject({
        type: z.literal("probeRoute"),
        route: agentRouteSchema,
        test: z.boolean(),
    }),
    z.strictObject({
        type: z.literal("read"),
        id: sessionId,
    }),
    z.strictObject({
        type: z.literal("select"),
        id: sessionId,
    }),
    z.strictObject({
        type: z.literal("connect"),
        id: sessionId,
    }),
    z.strictObject({
        type: z.literal("configureSession"),
        id: sessionId,
        route: agentRouteSchema,
    }),
    z.strictObject({
        type: z.literal("prompt"),
        id: sessionId,
        text: agentPromptSchema,
    }),
    z.strictObject({
        type: z.literal("enqueue"),
        id: sessionId,
        text: agentPromptSchema,
    }),
    z.strictObject({
        type: z.literal("cancelTurn"),
        id: sessionId,
    }),
    z.strictObject({
        type: z.literal("cancel"),
        id: sessionId,
    }),
    z.strictObject({
        type: z.literal("remove"),
        id: sessionId,
    }),
]);
const apiKeyRevision = z.number().int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER);
export const apiKeyValueSchema = z.string().max(4096)
    .trim()
    .min(1)
    .regex(/^[!-~]+$/u);
export const settingsCommandSchema = z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("apiKeys") }),
    z.strictObject({
        type: z.literal("saveApiKey"),
        id: z.enum(API_KEY_PROVIDERS),
        key: apiKeyValueSchema,
        revision: apiKeyRevision,
    }),
    z.strictObject({
        type: z.literal("removeApiKey"),
        id: z.enum(API_KEY_PROVIDERS),
        revision: apiKeyRevision,
    }),
    z.strictObject({
        type: z.literal("testApiKey"),
        id: z.enum(API_KEY_PROVIDERS),
        revision: apiKeyRevision,
    }),
    z.strictObject({ type: z.literal("read") }),
    z.strictObject({ type: z.literal("providers") }),
    z.strictObject({ type: z.literal("providerAvailability") }),
    z.strictObject({
        type: z.literal("setup"),
        id: z.string().min(1)
            .max(512),
    }),
    z.strictObject({
        type: z.literal("probe"),
        route: agentRouteSchema,
        test: z.boolean(),
    }),
    z.strictObject({
        type: z.literal("configure"),
        routes: agentRoutesSchema,
        revision: z.number().int()
            .min(0)
            .max(Number.MAX_SAFE_INTEGER),
    }),
]);
export type AgentSessionCommand = z.infer<typeof agentSessionCommandSchema>;
export type SettingsCommand = z.infer<typeof settingsCommandSchema>;
type ResultOf<T> = T extends (...args: never[]) => infer R ? Awaited<R> : never;
export type AgentSessionResults = { [K in AgentSessionCommand["type"]]: ResultOf<AgentSessionsApi[K]> };
export interface SettingsResults {
    apiKeys: ResultOf<SettingsApi["apiKeys"]["read"]>;
    saveApiKey: void;
    removeApiKey: void;
    testApiKey: ResultOf<SettingsApi["apiKeys"]["test"]>;
    read: ResultOf<SettingsApi["read"]>;
    providers: ResultOf<AgentProvidersApi["list"]>;
    providerAvailability: ResultOf<AgentProvidersApi["availability"]>;
    setup: void;
    probe: ResultOf<SettingsApi["probeRoute"]>;
    configure: void;
}
export type ViewRequest = z.infer<typeof viewRequestSchema>;
export interface ViewResults {
    inspect: DesktopView;
    list: readonly DesktopView[];
    open: DesktopView;
    focus: void;
    close: void;
    controller: void;
}
export type LiveRequest = z.infer<typeof liveRequestSchema>;
export type LiveResults = { [K in LiveRequest["type"]]: ResultOf<LiveVoiceApi[K]> };
export interface CanvasResults {
    list: CanvasListing;
    read: CanvasDocument;
    create: CanvasReceipt;
    rename: CanvasReceipt;
    receipt: CanvasReceipt | null;
    render: CanvasReceipt;
}
export type { BlockResults } from "./canvas/blocks";

/** Request and response correlation for the command channels used by desktop windows. */
export interface WindowCommands {
    "agent-sessions:command": {
        request: AgentSessionCommand;
        results: AgentSessionResults;
    };
    "settings:command": {
        request: SettingsCommand;
        results: SettingsResults;
    };
    "desktop-views:request": {
        request: z.infer<typeof viewRequestSchema>;
        results: ViewResults;
    };
    "live:command": {
        request: LiveRequest;
        results: LiveResults;
    };
    "canvas-service:request": {
        request: CanvasRequest;
        results: CanvasResults;
    };
    "dashboard-blocks:request": {
        request: BlockRuntimeRequest;
        results: BlockResults;
    };
}
export type CommandChannel = keyof WindowCommands;
export type CommandRequest<C extends CommandChannel> = WindowCommands[C]["request"];
export type CommandResponse<C extends CommandChannel, R extends CommandRequest<C>> =
    WindowCommands[C]["results"][R["type"] & keyof WindowCommands[C]["results"]];

export type WindowResults = {
    [C in CommandChannel]: CommandResponse<C, CommandRequest<C>>;
} & {
    "agent-providers:availability": ResultOf<AgentProvidersApi["availability"]>;
    "agent-providers:list": ResultOf<AgentProvidersApi["list"]>;
    "settings:open": void;
};

export interface WindowWireInvoke {
    <C extends CommandChannel, R extends CommandRequest<C>>(channel: C, request: R): Promise<IpcResult<CommandResponse<C, R>>>;
    (channel: "agent-providers:list", refresh?: boolean): Promise<IpcResult<WindowResults["agent-providers:list"]>>;
    (channel: "agent-providers:availability"): Promise<IpcResult<WindowResults["agent-providers:availability"]>>;
    (channel: "settings:open"): Promise<IpcResult<WindowResults["settings:open"]>>;
}

/** Each command implementation is checked against its own response, not a broad union. */
export type CommandHandlers<R extends {
    type: string;
}, Results extends Record<R["type"], unknown>> = {
    [K in R["type"]]: (request: Extract<R, {
        type: K;
    }>) => Results[K] | Promise<Results[K]>;
};

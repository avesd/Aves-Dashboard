/**
 * @author Avesd
 * @package Desktop
 * @namespace Shared
 * @description Desktop API
 */

import type { DataSourceDefinition, WidgetDefinition } from "@avesd/workspace-model";

export interface AgentWorkbenchContext {
    readonly dataSourceDefinitions: readonly DataSourceDefinition[];
    readonly widgetDefinitions: readonly WidgetDefinition[];
}

export const agentIpcChannels = Object.freeze({
    settings: "agent:settings",
    provider: "agent:provider",
    model: "agent:model",
    effort: "agent:effort",
    cancel: "agent:cancel",
    connect: "agent:connect",
    configureWorkbench: "agent:configure-workbench",
    event: "agent:event",
    prompt: "agent:prompt",
});

export const workspaceIpcChannels = Object.freeze({
    changed: "workspace:changed",
    load: "workspace:load",
    save: "workspace:save",
});

export const parseAgentPrompt = (input: unknown): string => {

    if (typeof input !== "string") {
        throw new TypeError("Agent prompt must be a string");
    }

    const prompt = input.trim();
    if (prompt.length === 0) {
        throw new Error("Agent prompt cannot be empty");
    }
    if (prompt.length > 32_768) {
        throw new Error("Agent prompt is too long");
    }

    return prompt;
};

/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Agent Tools
 */

import { canvasToolDefinitions } from "../canvas/canvas-tools";
import { McpServer } from "@modelcontextprotocol/server";

export interface AgentToolResult {
    readonly content: ({
        type: "text";
        text: string;
    } | {
        type: "image";
        data: string;
        mimeType: "image/png";
    })[];
    readonly isError?: boolean;
}

export const agentToolNames = Object.keys(canvasToolDefinitions);

export function createAgentMcpServer(invoke: (name: string, input: unknown) => Promise<AgentToolResult>): McpServer {

    const server = new McpServer({
        name: "avesd-workspace",
        version: "0.2.0",
    });
    for (const [
        name,
        definition,
    ] of Object.entries(canvasToolDefinitions)) {
        server.registerTool(name, {
            description: definition.description,
            inputSchema: definition.schema,
        }, async (input: unknown) => {

            return { ...await invoke(name, input) };
        });
    }

    return server;
}

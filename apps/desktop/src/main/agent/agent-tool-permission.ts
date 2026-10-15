/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Agent Tool Permission
 */

import { canvasToolDefinitions } from "../canvas/canvas-tools";
import { agentToolNames } from "./agent-tools";
import type { AcpToolPermissionFormat } from "@avesd/acp-management";

export const AVESD_MCP_SERVER_NAME = "avesd";
export function authorizeAvesdTool(toolCall: {
    readonly name?: string | null;
    readonly title?: string | null;
    readonly kind?: string | null;
    readonly rawInput?: unknown;
}, format: AcpToolPermissionFormat = "server-tool"): boolean {

    const input = toolCall.rawInput;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return false;
    }
    if (format === "qualified-name") {
        // OpenCode reports the qualified MCP identifier with direct tool arguments.
        // Permission can precede arguments; the scoped gateway validates the actual call.
        return Object.entries(canvasToolDefinitions).some(([
            name,
            definition,
        ]) => {

            const qualified = `${AVESD_MCP_SERVER_NAME}_${name}`;
            const identifier = toolCall.name ?? toolCall.title;

            return identifier === qualified && toolCall.kind === "other"
                && (Object.keys(input).length === 0 || definition.schema.safeParse(input).success);
        });
    }

    return "server" in input && input.server === AVESD_MCP_SERVER_NAME
    && "tool" in input && typeof input.tool === "string" && agentToolNames.includes(input.tool);
}

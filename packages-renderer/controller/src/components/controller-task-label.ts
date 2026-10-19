/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Components
 * @description Derive compact task feedback independently of the voice connection
 */

import type { AgentSessionSnapshot } from "@avesd/desktop-contracts/agent/sessions";

export function controllerTaskLabel(session: AgentSessionSnapshot | null, sending: boolean): string {

    if (session?.execution?.status === "cancelling") {
        return "Cancelling task…";
    }
    if (session?.waitingForAnswer) {
        return "Your answer is needed · view details";
    }
    if (sending) {
        return "Sending request…";
    }
    if (!session) {
        return "Ready when you are";
    }
    if (session.status === "running") {
        if (session.queuedPrompts.length > 0) {
            return `Working · ${session.queuedPrompts.length} queued`;
        }

        return "Working on your canvas…";
    }
    if (session.execution?.status === "cancelled") {
        return "Task cancelled";
    }
    const labels: Record<AgentSessionSnapshot["status"], string> = {
        idle: "Ready for your next request",
        running: "Working on your canvas…",
        completed: "Task complete · view results",
        error: "Task failed · view details",
        stopped: "Conversation stopped",
    };

    return labels[session.status];
}

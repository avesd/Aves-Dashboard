/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Agent_Sessions
 * @description Session Events
 */

import type { AgentSessionSnapshot } from "../../../shared/agent/sessions";
import type { SessionEntry } from "./session-state";
import type { AgentEvent } from "@avesd/plugin-api";

export function sessionSnapshot(entry: SessionEntry): AgentSessionSnapshot {

    return {
        ...entry.summary,
        events: entry.events,
        queuedPrompts: entry.queue.map(item => {

            return { ...item };
        }),
        settings: entry.settings,
    };
}

export function recordSessionEvent(entry: SessionEntry, event: AgentEvent): void {

    if (event.type === "messageChunk" && entry.execution?.task && entry.execution.phase === "active") {
        entry.execution.task.answer += event.text;
    }
    if (event.type === "settings") {
        entry.settings = event.settings;
    }
    if (event.type === "status" && entry.settings) {
        entry.settings = {
            ...entry.settings,
            status: event.status,
        };
    }
    if (event.type === "status" && (event.status === "error" || event.status === "disconnected")) {
        if (entry.connection.status === "ready") {
            entry.connection = { status: "unprepared" };
        }
    }
    if (event.type === "sessionReset" || (event.type === "status" && event.status === "disconnected")) {
        entry.waitingQuestion = undefined;
        entry.summary = {
            ...entry.summary,
            waitingForAnswer: false,
        };
    }
    if (event.type === "sessionReset") {
        entry.events.length = 0;
        entry.bytes = 0;
    }
    entry.events.push({
        sequence: ++entry.sequence,
        event,
    });
    entry.bytes += JSON.stringify(event).length;
    while (entry.bytes > 524288 && entry.events.length > 1) {
        entry.bytes -= JSON.stringify(entry.events.shift()!.event).length;
    }
}

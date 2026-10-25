/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Chat
 * @description Agent Transcript
 */

import type { AgentSessionSnapshot } from "@avesd/desktop-contracts/agent/sessions";
import type { AgentEvent } from "@avesd/plugin-api";

export type TranscriptEntry =
    | {
        id: number;
        kind: "user" | "answer" | "thought";
        text: string;
    }
    | {
        id: number;
        kind: "tool";
        toolId: string;
        title: string;
        status: string;
        input?: string;
        output?: string;
    };

export function appendAgentEvent(entries: readonly TranscriptEntry[], event: AgentEvent, id: number): readonly TranscriptEntry[] {

    if (event.type === "sessionReset") {
        return [];
    }
    if (event.type === "turnStarted" || event.type === "turnComplete"
        || (event.type === "status" && (event.status === "error" || event.status === "disconnected"))) {
        return finishTools(entries);
    }
    if (event.type === "toolCall") {
        const index = entries.findIndex(entry => {

            return entry.kind === "tool" && entry.toolId === event.id;
        });
        const previous = entries[index];
        const tool: TranscriptEntry = {
            id: previous?.id ?? id,
            kind: "tool",
            toolId: event.id,
            title: "Tool call",
            status: "pending",
            ...(previous?.kind === "tool" ? previous : {}),
            ...(event.title !== undefined ? { title: event.title } : {}),
            ...(event.status !== undefined ? { status: event.status } : {}),
            ...(event.input !== undefined ? { input: event.input } : {}),
            ...(event.output !== undefined ? { output: event.output } : {}),
        };

        return index < 0 ? [
            ...entries,
            tool,
        ] : entries.map((entry, offset) => {

            return offset === index ? tool : entry;
        });
    }
    if (event.type === "messageChunk" || event.type === "thoughtChunk" || event.type === "userMessage") {
        const kind = ({
            userMessage: "user",
            messageChunk: "answer",
            thoughtChunk: "thought",
        } as const)[event.type];
        const last = entries.at(-1);
        if (kind !== "user" && last?.kind === kind) {
            return [
                ...entries.slice(0, -1),
                {
                    ...last,
                    text: last.text + event.text,
                },
            ];
        }

        return [
            ...entries,
            {
                id,
                kind,
                text: event.text,
            },
        ];
    }

    return entries;
}

export function projectAgentTranscript(session: Pick<AgentSessionSnapshot, "events" | "execution" | "status"> | null): readonly TranscriptEntry[] {

    if (!session) {
        return [];
    }
    const entries = session.events.reduce<readonly TranscriptEntry[]>((previous, { event, sequence }) => {

        return appendAgentEvent(previous, event, sequence);
    }, []);
    if (session.status === "stopped") {
        return finishTools(entries);
    }
    if (session.execution) {
        switch (session.execution.status) {
            case "running":
            case "cancelling":
                return entries;
            case "cancelled":
            case "completed":
            case "error":
                return finishTools(entries);
        }
    }

    return session.status === "running" ? entries : finishTools(entries);
}

export function finishTools(entries: readonly TranscriptEntry[]): readonly TranscriptEntry[] {

    return entries.map(entry => {

        return entry.kind === "tool" && [
            "pending",
            "in_progress",
        ].includes(entry.status) ? {
                ...entry,
                status: "interrupted",
            } : entry;
    });
}

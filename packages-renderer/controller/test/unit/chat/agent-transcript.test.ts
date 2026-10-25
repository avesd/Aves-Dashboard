/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Test_Unit_Chat
 * @description Tool transcript projection follows execution and ordered turn boundaries
 */

import type { TranscriptEntry } from "../../../src/chat/agent-transcript.ts";
import { projectAgentTranscript } from "../../../src/chat/agent-transcript.ts";
import type { AgentSessionSnapshot } from "@avesd/desktop-contracts/agent/sessions";
import type { AgentEvent } from "@avesd/plugin-api";
import assert from "node:assert/strict";
import { test } from "node:test";

function transcript(events: readonly AgentEvent[], executionStatus: NonNullable<AgentSessionSnapshot["execution"]>["status"], status: AgentSessionSnapshot["status"] = "running") {

    return projectAgentTranscript({
        events: events.map((event, index) => {

            return {
                event,
                sequence: index + 1,
            };
        }),
        execution: {
            id: "synthetic-execution",
            status: executionStatus,
        },
        status,
    });
}

function toolStatuses(entries: readonly TranscriptEntry[]) {

    return entries.filter(entry => {

        return entry.kind === "tool";
    }).map(entry => {

        return {
            id: entry.toolId,
            status: entry.status,
        };
    });
}

void test("terminal execution snapshots interrupt unfinished tools and retain known outcomes", () => {

    const events: AgentEvent[] = [
        { type: "turnStarted" },
        {
            type: "toolCall",
            id: "pending",
        },
        {
            type: "toolCall",
            id: "active",
            status: "in_progress",
        },
        {
            type: "toolCall",
            id: "completed",
            status: "completed",
        },
        {
            type: "toolCall",
            id: "failed",
            status: "failed",
        },
    ];

    for (const status of [
        "cancelled",
        "error",
        "completed",
    ] as const) {
        const entries = transcript(events, status);

        assert.deepEqual(toolStatuses(entries), [
            {
                id: "pending",
                status: "interrupted",
            },
            {
                id: "active",
                status: "interrupted",
            },
            {
                id: "completed",
                status: "completed",
            },
            {
                id: "failed",
                status: "failed",
            },
        ]);
    }
});

void test("running and cancelling executions retain their active tool rows", () => {

    for (const status of [
        "running",
        "cancelling",
    ] as const) {
        const entries = transcript([
            { type: "turnStarted" },
            {
                type: "toolCall",
                id: "active",
                status: "in_progress",
            },
        ], status);

        assert.deepEqual(toolStatuses(entries), [
            {
                id: "active",
                status: "in_progress",
            },
        ]);
    }
});

void test("earlier turn endings never interrupt a later active tool", () => {

    const endings: readonly (AgentEvent | undefined)[] = [
        undefined,
        {
            type: "turnComplete",
            stopReason: "synthetic-completion",
        },
        {
            type: "status",
            status: "error",
        },
        {
            type: "status",
            status: "disconnected",
        },
    ];

    for (const ending of endings) {
        const entries = transcript([
            { type: "turnStarted" },
            {
                type: "toolCall",
                id: "old",
                status: "in_progress",
            },
            ...(ending ? [ending] : []),
            {
                type: "userMessage",
                text: "Synthetic later turn",
            },
            { type: "turnStarted" },
            {
                type: "toolCall",
                id: "new",
                status: "in_progress",
            },
        ], "running");

        assert.deepEqual(toolStatuses(entries), [
            {
                id: "old",
                status: "interrupted",
            },
            {
                id: "new",
                status: "in_progress",
            },
        ]);
    }
});

void test("permanently stopped sessions interrupt tools even before their host settles", () => {

    const entries = transcript([
        {
            type: "toolCall",
            id: "stopped",
            status: "in_progress",
        },
    ], "running", "stopped");

    assert.deepEqual(toolStatuses(entries), [
        {
            id: "stopped",
            status: "interrupted",
        },
    ]);
});

void test("session resets discard prior rows without finishing the new execution", () => {

    const entries = transcript([
        {
            type: "toolCall",
            id: "discarded",
            status: "in_progress",
        },
        { type: "sessionReset" },
        { type: "turnStarted" },
        {
            type: "toolCall",
            id: "current",
            status: "in_progress",
        },
    ], "running");

    assert.deepEqual(toolStatuses(entries), [
        {
            id: "current",
            status: "in_progress",
        },
    ]);
    assert.deepEqual(projectAgentTranscript(null), []);
});

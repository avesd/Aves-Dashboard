/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Agent_Sessions
 * @description Session Execution
 */

import type { AgentSessionsChange, AgentSessionSummary } from "../../../shared/agent/sessions";
import type { SessionHost } from "../session-host";
import type { AnswerContinuation, Execution, SessionEntry, SessionTaskResult } from "./session-state";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { AgentEvent } from "@avesd/plugin-api";
import { randomUUID } from "node:crypto";

interface ExecutionContext {
    readonly task?: SessionTaskResult;
    readonly disposed: () => boolean;
    readonly ended: (entry: SessionEntry) => boolean;
    readonly runningCount: () => number;
    readonly hasEntry: (id: string) => boolean;
    readonly prepare: (entry: SessionEntry) => Promise<SessionHost>;
    readonly record: (entry: SessionEntry, event: AgentEvent) => void;
    readonly changed: (change: AgentSessionsChange) => void;
    readonly resume: (entry: SessionEntry) => Promise<void>;
}

interface CancellationContext {
    readonly timeoutMs: number;
    readonly detach: (entry: SessionEntry) => void;
    readonly record: (entry: SessionEntry, event: AgentEvent) => void;
}

export async function runSessionPrompt(entry: SessionEntry, text: string, continuation: AnswerContinuation | undefined, context: ExecutionContext): Promise<void> {

    if (entry.summary.status === "stopped" || entry.summary.status === "running" || context.disposed()) {
        throw new OperationError(IpcErrorCode.Busy, "This session is stopped or already responding.");
    }
    let finish!: () => void;
    let abort!: () => void;
    const finished = new Promise<void>(resolve => {

        finish = resolve;
    });
    const aborted = new Promise<void>(resolve => {

        abort = resolve;
    });
    const execution: Execution = {
        id: randomUUID(),
        phase: "preparing",
        finished,
        finish,
        aborted,
        abort,
        ...(context.task ? { task: context.task } : {}),
    };
    entry.execution = execution;
    entry.turnId = execution.id;
    entry.waitingQuestion = undefined;
    if (continuation) {
        continuation.turnId = entry.turnId;
    }
    setExecutionStatus(entry, execution, "running");
    entry.summary = {
        ...entry.summary,
        waitingForAnswer: false,
    };
    context.record(entry, {
        type: "userMessage",
        text,
    });
    context.record(entry, { type: "turnStarted" });
    try {
        if (context.runningCount() > 8) {
            throw new OperationError(IpcErrorCode.Busy, "At most eight agent tasks can run concurrently.");
        }
        const work = async () => {

            const host = continuation ? entry.host : await context.prepare(entry);
            if (context.ended(entry) || execution.phase === "cancelled" || entry.execution !== execution) {
                return;
            }
            if (!host) {
                throw new OperationError(IpcErrorCode.ServiceNotReady, "The original Agent conversation has ended.");
            }
            execution.phase = "active";
            if (continuation) {
                await host.continuePrompt(text, continuation.owner.connectionId, execution.id);
            } else {
                await host.prompt(text, execution.id);
            }
        };
        await Promise.race([
            work(),
            execution.aborted,
        ]);
        if (!context.ended(entry) && execution.phase !== "cancelled") {
            setExecutionStatus(entry, execution, "completed");
        }
    } catch (error) {
        const failure = error instanceof OperationError
            ? error
            : new OperationError(IpcErrorCode.Internal, "Agent task failed. Please try again.");
        if (!context.ended(entry) && execution.phase !== "cancelled") {
            entry.queue.length = 0;
            setExecutionStatus(entry, execution, "error");
            if (entry.settings?.status !== "error") {
                context.record(entry, {
                    type: "status",
                    status: "error",
                    message: failure.message,
                });
            }
        }
        if (execution.phase !== "cancelled") {
            throw failure;
        }
    } finally {
        if (execution.phase === "cancelled" && execution.task) {
            execution.task.status = "cancelled";
        }
        if (execution.phase !== "cancelled") {
            execution.phase = "settled";
        }
        if (entry.execution === execution) {
            entry.execution = undefined;
            if (execution.phase === "cancelled" && !context.ended(entry)) {
                setExecutionStatus(entry, execution, "cancelled");
            }
        }
        execution.finish();
        if (context.hasEntry(entry.summary.id)) {
            context.changed({
                type: "updated",
                id: entry.summary.id,
            });
        }
        if (!continuation) {
            void context.resume(entry);
        }
    }
}

/** The summary retains the last result after the live execution is released. */
export function setExecutionStatus(entry: SessionEntry, execution: Execution, status: NonNullable<AgentSessionSummary["execution"]>["status"]): void {

    if (execution.task) {
        execution.task.status = status;
    }
    let sessionStatus: AgentSessionSummary["status"];
    switch (status) {
        case "running":
        case "cancelling":
            sessionStatus = "running";
            break;
        case "cancelled":
            sessionStatus = "idle";
            break;
        case "completed":
        case "error":
            sessionStatus = status;
            break;
    }
    entry.summary = {
        ...entry.summary,
        status: sessionStatus,
        execution: {
            id: execution.id,
            status,
        },
    };
}

export async function cancelSessionExecution(entry: SessionEntry, execution: Execution, context: CancellationContext): Promise<void> {

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        void entry.host?.cancel().catch(() => {
        });
        const settled = await Promise.race([
            execution.finished.then(() => {

                return true;
            }),
            new Promise<boolean>(resolve => {

                timer = setTimeout(() => {

                    return void resolve(false);
                }, context.timeoutMs);
            }),
        ]);
        if (!settled && entry.execution === execution) {
            context.detach(entry);
            entry.summary = {
                ...entry.summary,
                connectionReset: true,
            };
            context.record(entry, {
                type: "status",
                status: "disconnected",
                message: "The Agent did not finish cancelling in time. Its connection was released; the next request starts a new Agent conversation. Completed changes are retained.",
            });
            execution.abort();
            await execution.finished;
        }
    } finally {
        clearTimeout(timer);
    }
}

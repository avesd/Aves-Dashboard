/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Agent_Sessions
 * @description Session Continuations
 */

import type { AgentSessionsChange } from "../../../shared/agent/sessions";
import type { AnswerContinuation, AnswerContinuationStatus, SessionEntry } from "./session-state";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { BlockQuestionOwner } from "@avesd/workspace-model";

interface ContinuationContext {
    readonly getEntry: (id: string) => SessionEntry | undefined;
    readonly requireEntry: (id: string) => SessionEntry;
    readonly ended: (entry: SessionEntry) => boolean;
    readonly changed: (change: AgentSessionsChange) => void;
    readonly drain: (entry: SessionEntry) => void;
    readonly prompt: (entry: SessionEntry, text: string, continuation: AnswerContinuation) => Promise<void>;
}

/** Rechecks question ownership before and after asynchronous admission. */
export class SessionContinuations {
    constructor(private readonly context: ContinuationContext) {}

    questionOwner(id: string): BlockQuestionOwner | undefined {

        const entry = this.context.getEntry(id);
        const connectionId = entry?.host?.continuationToken();

        return entry && !this.context.ended(entry) && entry.summary.kind === "interactive" && entry.summary.status === "running"
            && entry.execution?.phase === "active" && entry.turnId && connectionId ? {
                sessionId: id,
                connectionId,
                turnId: entry.turnId,
            } : undefined;
    }

    questionActive(owner: BlockQuestionOwner, pending: boolean): boolean {

        const entry = this.context.getEntry(owner.sessionId);

        return !!entry && !this.context.ended(entry) && entry.host?.continuationToken() === owner.connectionId
            && (!pending || entry.turnId === owner.turnId);
    }

    waitForAnswer(owner: BlockQuestionOwner, key: string, waiting: boolean): void {

        const entry = this.context.getEntry(owner.sessionId);
        if (!entry || (waiting ? !this.questionActive(owner, true) : entry.waitingQuestion !== key)) {
            return;
        }
        entry.waitingQuestion = waiting ? key : undefined;
        entry.summary = {
            ...entry.summary,
            waitingForAnswer: waiting,
        };
        this.context.changed({
            type: "updated",
            id: owner.sessionId,
        });
    }

    continuationStatus(owner: BlockQuestionOwner, id: string): AnswerContinuationStatus {

        if (!this.questionActive(owner, false)) {
            return "unavailable";
        }

        const entry = this.context.getEntry(owner.sessionId)!;
        const answer = entry.answers.get(id);

        return answer?.status === "error" && entry.turnId !== answer.turnId ? "unavailable" : answer?.status ?? "unavailable";
    }

    /** Register after the answer is durably saved; never hold the block action open. */
    respond(owner: BlockQuestionOwner, id: string, text: string, active: () => Promise<boolean>): AnswerContinuationStatus {

        if (!this.questionActive(owner, false)) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "The original Agent conversation has ended.");
        }
        const entry = this.context.requireEntry(owner.sessionId);
        const previous = entry.answers.get(id);
        if (previous && previous.status !== "error") {
            return previous.status;
        }
        if (previous && entry.turnId !== previous.turnId) {
            throw new OperationError(IpcErrorCode.VersionConflict, "This answer has been superseded by another turn.");
        }
        if (!previous && !this.questionActive(owner, true)) {
            throw new OperationError(IpcErrorCode.VersionConflict, "The question belongs to an earlier turn.");
        }
        if (!previous && entry.answers.size >= 64) {
            throw new OperationError(IpcErrorCode.Busy, "This session has reached its canvas answer limit.");
        }
        entry.answers.set(id, {
            id,
            owner,
            text,
            active,
            status: "queued",
        });
        entry.waitingQuestion = undefined;
        entry.summary = {
            ...entry.summary,
            waitingForAnswer: false,
        };
        this.context.changed({
            type: "updated",
            id: owner.sessionId,
        });
        void this.resume(entry);

        return "queued";
    }

    async resume(entry: SessionEntry): Promise<void> {

        if (this.context.ended(entry) || entry.summary.status === "running" || entry.continuing) {
            return;
        }
        const answer = [...entry.answers.values()].find(candidate => {

            return candidate.status === "queued";
        });
        if (!answer) {
            this.context.drain(entry);

            return;
        }
        entry.continuing = answer;
        try {
            if (!this.questionActive(answer.owner, false) || !await answer.active()
                || answer.status !== "queued" || !this.questionActive(answer.owner, false)) {
                answer.status = "unavailable";

                return;
            }
            answer.status = "running";
            await this.context.prompt(entry, answer.text, answer);
            // Cancellation may invalidate the answer while its prompt is pending.
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (answer.status === "running") {
                answer.status = "completed";
            }
        } catch {
            answer.status = this.questionActive(answer.owner, false) ? "error" : "unavailable";
        } finally {
            if (entry.continuing === answer) {
                entry.continuing = undefined;
                this.context.changed({
                    type: "updated",
                    id: entry.summary.id,
                });
                void this.resume(entry);
            }
        }
    }

}

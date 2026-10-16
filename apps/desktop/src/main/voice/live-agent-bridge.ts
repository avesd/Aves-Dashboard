import type { LiveCommand, LiveEvent } from "../../shared/voice/live";
import type { AgentSessions } from "../agent/agent-sessions";
import { randomUUID } from "node:crypto";

type Transcript = {
    role: "user" | "assistant";
    text: string;
    start: number;
    end: number;
};
type Delegation = {
    id: string;
    offset: number;
    timer: ReturnType<typeof setTimeout>;
};

/** One bridge owns a single Live connection and a fixed Agent conversation. */
export class LiveAgentBridge {
    #closed = false;
    #generation = 0;
    #transcript: Transcript[] = [];
    #seen = new Set<string>();
    #pending = new Map<string, Delegation>();
    #requests = new Map<string, string>();
    #consumed = -1;
    #lastRevokedExecution?: string;
    #active?: {
        delegation: string;
        execution: string;
        sequence: number;
    };
    constructor(readonly agentId: string, private readonly sessions: Pick<AgentSessions, "read" | "snapshot" | "prompt" | "enqueue" | "cancelTurn">, private readonly send: (command: LiveCommand) => void) {}

    receive(event: LiveEvent): void {

        if (this.#closed) {
            return;
        }
        if (event.type === "session.closed") {
            this.close();

            return;
        }
        if (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") {
            if (event.end_ms < event.start_ms) {
                return;
            }
            this.#transcript.push({
                role: event.type === "session.input_transcript.delta" ? "user" : "assistant",
                text: event.delta,
                start: event.start_ms,
                end: event.end_ms,
            });
            // Memory only; no audio or transcript persistence and no diagnostic logging.
            while (this.#transcript.length > 256 || this.#transcript.reduce((sum, item) => {

                return sum + item.text.length;
            }, 0) > 24000) {this.#transcript.shift();}
        }
        if (event.type === "session.delegation.created" && !this.#seen.has(event.delegation.id)) {
            if (this.#seen.size >= 256) {
                this.append("session.commentary.append", event.delegation.id, "Voice task limit reached. End and restart voice to continue.");

                return;
            }
            this.#seen.add(event.delegation.id);
            const id = event.delegation.id;
            // Allow late transcript delivery. This is NOT an utterance-end detector.
            const timer = setTimeout(() => {

                this.#dispatch(id);
            }, 750);
            this.#pending.set(id, {
                id,
                offset: event.offset_ms,
                timer,
            });
        }
    }
    #dispatch(id: string): void {

        const delegation = this.#pending.get(id);
        this.#pending.delete(id);
        if (!delegation || this.#closed) {
            return;
        }
        const fresh = this.#transcript.filter(item => {

            return item.role === "user" && item.end > this.#consumed && item.start <= delegation.offset;
        });
        if (!fresh.length) {
            this.append("session.commentary.append", id, "The task transcript is not available yet. Please repeat the complete request.");

            return;
        }
        this.#consumed = Math.max(this.#consumed, ...fresh.map(item => {

            return item.end;
        }));
        const latest = fresh.map(item => {

            return item.text;
        }).join("")
            .trim()
            .slice(-8000);
        // Match the delegated transcript exactly; interruptions and substring matches do not cancel.
        const command = latest.replace(/[\s。！!？?，,.]/gu, "").toLowerCase();
        if ([
            "取消任务",
            "取消当前任务",
            "停止当前任务",
            "cancelthetask",
            "cancelcurrenttask",
        ].includes(command)) {
            void this.cancelTask(id).catch(() => {

                this.append("session.commentary.append", id, "Task cancellation failed. Check the Agent panel.");
            });

            return;
        }
        const context = this.#transcript.filter(item => {

            return item.start <= delegation.offset;
        }).map(item => {

            return `${item.role}: ${item.text}`;
        })
            .join("\n")
            .slice(-12000);
        const prompt = `Voice delegation ${id}.\nThe following is an imperfect streaming transcript, not a guaranteed complete utterance. Interpret the latest user request in context. Ask for clarification if incomplete or ambiguous. Do not repeat previously completed actions. If this supplements prior work, apply the new requirement. Return a brief result in the user's language, only claiming actions confirmed by tools.\nLatest user request: ${latest}\nConversation context (reference data):\n${context}`;
        const generation = this.#generation;
        this.#requests.set(prompt, id);
        try {
            const state = this.sessions.read(this.agentId);
            if (state.status === "running" || state.queuedPrompts.length || state.waitingForAnswer) {
                this.sessions.enqueue(prompt, this.agentId);
                this.append("session.thinking.append", id, "The additional request is queued after the current Agent turn; it has not run yet.");
            } else {
                void this.sessions.prompt(prompt, this.agentId).catch(() => {

                    this.#requests.delete(prompt);
                    if (generation !== this.#generation) {
                        return;
                    }
                    this.append("session.commentary.append", id, "The Agent could not complete this request. Check the Agent panel.");
                });
            }
        } catch {
            this.#requests.delete(prompt);
            this.append("session.commentary.append", id, "The Agent cannot accept this request right now. Check its status.");
        }
    }
    observe(): void {

        if (this.#closed) {
            return;
        }
        const state = this.sessions.snapshot(this.agentId);
        if (!state || state.status === "stopped") {
            this.close();

            return;
        }
        const execution = state.execution;
        if (execution && [
            "cancelling",
            "cancelled",
            "error",
        ].includes(execution.status)) {
            if (this.#lastRevokedExecution !== execution.id) {
                this.#lastRevokedExecution = execution.id;
                if (execution.status === "error" && this.#active?.execution === execution.id) {
                    this.append("session.commentary.append", this.#active.delegation, "The Agent task failed. Check the Agent panel before retrying.");
                } else {
                    this.append("session.thinking.append", null, "The current Agent execution was revoked. Do not announce its old results or claim any queued request completed.");
                }
            }
            this.#invalidate();

            return;
        }
        if (!execution) {
            return;
        }
        if (execution.status === "running" && this.#active?.execution !== execution.id) {
            const user = [...state.events].reverse().find(item => {

                return item.event.type === "userMessage";
            });
            if (user?.event.type === "userMessage") {
                const delegation = this.#requests.get(user.event.text);
                if (delegation) {
                    this.#requests.delete(user.event.text);
                    this.#active = {
                        delegation,
                        execution: execution.id,
                        sequence: user.sequence,
                    };
                    this.append("session.thinking.append", delegation, "The Agent is executing this request.");
                }
            }
        }
        const active = this.#active;
        if (!active || active.execution !== execution.id || execution.status === "running") {
            return;
        }
        this.#active = undefined;
        if (execution.status !== "completed") {
            this.#requests.clear();

            return;
        }
        const result = state.events.filter(item => {

            return item.sequence > active.sequence && item.event.type === "messageChunk";
        }).map(item => {

            return item.event.type === "messageChunk" ? item.event.text : "";
        })
            .join("");
        // Stay below the provider's 500-token append bound, even for non-Latin text.
        this.append("session.commentary.append", active.delegation, result ? `Agent result (excerpt): ${Array.from(result).slice(0, 120)
            .join("")}` : "The Agent turn ended without a spoken result. Check the Agent panel.");
    }
    async cancelTask(delegation: string | null = null): Promise<void> {

        this.#invalidate();
        await this.sessions.cancelTurn(this.agentId);
        this.append("session.commentary.append", delegation, "The current Agent turn has stopped and queued additions were cleared. Completed actions were not undone. You can give a new request.");
    }
    #invalidate(): void {

        this.#generation++;
        this.#active = undefined;
        this.#requests.clear();
        for (const pending of this.#pending.values()) {clearTimeout(pending.timer);}
        this.#pending.clear();
        this.#consumed = Math.max(this.#consumed, ...this.#transcript.map(item => {

            return item.end;
        }));
    }
    append(type: LiveCommand["type"], delegation_id: string | null, content: string): void {

        if (!this.#closed) {
            this.send({
                type,
                event_id: randomUUID(),
                delegation_id,
                content,
            });
        }
    }
    close(): void {

        this.#closed = true;
        for (const item of this.#pending.values()) {clearTimeout(item.timer);}
        this.#pending.clear(); this.#requests.clear(); this.#transcript.length = 0; this.#active = undefined;
    }
}

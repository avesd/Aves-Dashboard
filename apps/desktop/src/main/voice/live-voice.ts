/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Voice
 * @description Live Voice
 */

import type { LiveCommand, LiveEvent } from "../../shared/voice/live";
import type { AgentSessions } from "../agent/sessions/agent-sessions";
import { LiveAgentBridge } from "./live-agent-bridge";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import { z } from "zod";

const answerSchema = z.object({
    session: z.object({ id: z.string() }),
    transport: z.object({
        type: z.literal("webrtc"),
        sdp: z.string(),
    }),
});

export class LiveVoice {
    #connection?: {
        id: string;
        abort: AbortController;
        bridge: LiveAgentBridge;
        ready: boolean;
    };
    constructor(private readonly sessions: AgentSessions, private readonly send: (id: string, command: LiveCommand) => void, private readonly key: () => string | undefined, private readonly request: typeof fetch = fetch) {}
    availability(): {
        configured: boolean;
    } {

        try {
            return { configured: !!this.key()?.trim() };
        } catch {
            return { configured: false };
        }
    }
    async start(id: string, agentId: string, sdp: string): Promise<{
        sdp: string;
    }> {

        if (this.#connection) {
            throw new OperationError(IpcErrorCode.Busy, "End the current voice conversation first.");
        }
        const key = this.key();
        if (!key?.trim()) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Add an OpenAI API key in Settings → Models & services.");
        }
        const agent = this.sessions.read(agentId);
        if (agent.kind !== "interactive" || agent.status === "stopped") {
            throw new OperationError(IpcErrorCode.InvalidArgument, "Choose an active interactive Agent session.");
        }
        const bridge = new LiveAgentBridge(agentId, this.sessions, command => {

            if (this.#connection?.id === id) {
                this.send(id, command);
            }
        });
        const connection = {
            id,
            bridge,
            abort: new AbortController(),
            ready: false,
        };
        this.#connection = connection;
        try {
            const response = await this.request("https://api.openai.com/v1/live/sessions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                signal: AbortSignal.any([
                    connection.abort.signal,
                    AbortSignal.timeout(20000),
                ]),
                body: JSON.stringify({
                    session: {
                        model: "gpt-live-1",
                        instructions: "You are Avesd's voice assistant. Speak concise natural Chinese unless the user uses another language. Listen and yield when the user interrupts. Delegate workspace tasks, task amendments, and explicit task cancellation requests to the client. Do not pretend to execute tools yourself. The client controls an existing Agent Agent. Requests during execution are queued, not immediate edits. Never claim completion or cancellation until client feedback confirms it. Ordinary interruptions stop speech only, not Agent work. If a request is incomplete, clarify before delegating. To cancel a task the user can say the standalone command '取消当前任务' or use Cancel task. Only verified backend results establish task state.",
                        delegation: { type: "client" },
                    },
                    transport: {
                        type: "webrtc",
                        sdp,
                    },
                }),
            });
            if (!response.ok) {
                throw new OperationError(IpcErrorCode.ServiceNotReady, `GPT-Live connection failed (HTTP ${response.status}). Check API access and billing.`);
            }
            const answer = answerSchema.parse(await response.json());
            if (this.#connection !== connection) {
                throw new OperationError(IpcErrorCode.ServiceNotReady, "Voice connection was closed.");
            }

            return { sdp: answer.transport.sdp };
        } catch (error) {
            if (this.#connection === connection) {
                this.stop(id);
            }
            if (error instanceof Error && error.message.startsWith("GPT-Live connection failed")) {
                throw error;
            }

            throw new OperationError(IpcErrorCode.ServiceNotReady, "Could not establish the voice connection. Check network and API configuration.");
        }
    }
    event(id: string, event: LiveEvent): void {

        const connection = this.#connection;
        if (!connection || connection.id !== id) {
            return;
        }
        if (event.type === "session.started") {
            connection.ready = true;
        }
        if (!connection.ready) {
            return;
        }
        connection.bridge.receive(event);
        if (event.type === "session.closed") {
            this.stop(id);
        }
    }
    observe(agentId: string): void {

        if (this.#connection?.bridge.agentId === agentId) {
            this.#connection.bridge.observe();
        }
    }
    async cancelTask(id: string): Promise<void> {

        if (this.#connection?.id !== id || !this.#connection.ready) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Voice is not connected.");
        }
        await this.#connection.bridge.cancelTask();
    }
    stop(id?: string): void {

        if (!this.#connection || (id && id !== this.#connection.id)) {
            return;
        }
        this.#connection.abort.abort();
        this.#connection.bridge.close();
        this.#connection = undefined;
    }
}

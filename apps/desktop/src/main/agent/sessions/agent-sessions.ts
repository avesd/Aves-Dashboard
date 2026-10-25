/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description In-memory lifecycle and transcripts for independent Agent sessions
 */

import type { AgentSessionsChange, AgentSessionSnapshot, AgentSessionSummary, AgentTierRoute } from "../../../shared/agent/sessions";
import type { AgentPreferences } from "../agent-preferences";
import type { SessionHost } from "../session-host";
import { SessionConnections } from "./session-connection";
import { SessionContinuations } from "./session-continuations";
import { recordSessionEvent, sessionSnapshot } from "./session-events";
import { cancelSessionExecution, runSessionPrompt, setExecutionStatus } from "./session-execution";
import type { AnswerContinuation, AnswerContinuationStatus, SessionEntry, SessionOrigin, SessionTask, SessionTaskResult } from "./session-state";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { AgentEvent, AgentSettings, AgentTier } from "@avesd/plugin-api";
import type { BlockQuestionOwner } from "@avesd/workspace-model";
import { randomUUID } from "node:crypto";

export type { AnswerContinuationStatus, SessionOrigin, SessionTask } from "./session-state";

export class AgentSessions {
    readonly #entries = new Map<string, SessionEntry>();
    readonly #listeners = new Set<(event: AgentEvent) => void>();
    #selectedId?: string;
    #disposed = false;
    readonly #connections = new SessionConnections({
        factory: (origin, route, sessionId) => {

            return this.factory(origin, route, sessionId);
        },
        ended: entry => {

            return this.#ended(entry);
        },
        getEntry: id => {

            return this.#entries.get(id);
        },
        record: (entry, event) => {

            this.#record(entry, event);
        },
    });
    readonly #continuations = new SessionContinuations({
        getEntry: id => {

            return this.#entries.get(id);
        },
        requireEntry: id => {

            return this.#entry(id);
        },
        ended: entry => {

            return this.#ended(entry);
        },
        changed: change => {

            this.changed(change);
        },
        prompt: (entry, text, answer) => {

            return this.#prompt(entry, text, answer);
        },
        drain: entry => {

            this.#drain(entry);
        },
    });
    constructor(
        readonly preferences: AgentPreferences,
        private readonly origin: () => Promise<SessionOrigin>,
        private readonly factory: (origin: SessionOrigin, route: AgentTierRoute, sessionId: string) => Promise<{
            host: SessionHost;
            release(): void;
        }>,
        private readonly changed: (change: AgentSessionsChange) => void,
        private readonly cancellationTimeoutMs = 5000,
    ) {}

    list(): {
        selectedId?: string;
        sessions: readonly AgentSessionSummary[];
    } {

        return {
            selectedId: this.#selectedId,
            sessions: [...this.#entries.values()].map(entry => {

                return entry.summary;
            }).reverse(),
        };
    }
    read(id: string): AgentSessionSnapshot {

        const snapshot = this.snapshot(id);
        if (!snapshot) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Agent session is unavailable.");
        }

        return snapshot;
    }
    snapshot(id: string): AgentSessionSnapshot | null {

        const entry = this.#entries.get(id);
        if (!entry) {
            return null;
        }

        return sessionSnapshot(entry);
    }
    owner(id: string): SessionOrigin {

        return this.#entry(id).origin;
    }

    async create(tier: AgentTier = "flagship", origin?: SessionOrigin, route?: AgentTierRoute): Promise<{
        id: string;
    }> {

        const resolved = origin ?? await this.origin();
        if (this.#disposed || this.#entries.size >= 32) {
            throw new OperationError(IpcErrorCode.Busy, "Close an existing session before creating another (limit 32).");
        }
        const id = randomUUID();
        const entry: SessionEntry = {
            origin: resolved,
            route: { ...(route ?? this.preferences.routes[tier]) },
            events: [],
            sequence: 0,
            bytes: 0,
            generation: 0,
            queue: [],
            connection: { status: "unprepared" },
            configuring: false,
            answers: new Map(),
            summary: {
                id,
                route: { ...(route ?? this.preferences.routes[tier]) },
                tier,
                kind: resolved.kind,
                source: resolved.source,
                workspaceId: resolved.workspaceId,
                dashboardId: resolved.dashboardId,
                status: "idle",
                createdAt: Date.now(),
            },
        };
        this.#entries.set(id, entry);
        if (resolved.kind === "interactive") {
            this.select(id);
        }
        else {
            this.changed({
                type: "updated",
                id,
            });
        }

        return { id };
    }
    select(id: string): void {

        const entry = this.#entry(id);
        this.#selectedId = id;
        this.#legacy({ type: "sessionReset" });
        for (const { event } of entry.events) {
            this.#legacy(event);
        }
        this.changed({
            type: "selectionChanged",
            id,
        });
    }
    async connect(id?: string): Promise<void> {

        const entry = await this.#resolve(id);
        await this.#connections.prepare(entry);
        if (entry.summary.status === "error") {
            entry.summary = {
                ...entry.summary,
                status: "idle",
            };
            this.changed({
                type: "updated",
                id: entry.summary.id,
            });
        }
    }
    async prompt(text: string, id?: string): Promise<void> {

        await this.#submitPrompt(text, id);
    }

    /** A block retains this execution's result even when its conversation is reused. */
    startTask(text: string, id: string): SessionTask {

        const result: SessionTaskResult = {
            status: "running",
            answer: "",
        };
        void this.#submitPrompt(text, id, result).catch(() => {

            result.status = "error";
        });

        return {
            id,
            snapshot: () => {

                return { ...result };
            },
        };
    }

    async #submitPrompt(text: string, id?: string, task?: SessionTaskResult): Promise<void> {

        const entry = await this.#resolve(id);
        if (entry.configuring || entry.queue.length > 0) {
            throw new OperationError(IpcErrorCode.Busy, "Wait for the Agent configuration change to finish.");
        }
        if (entry.continuing || [...entry.answers.values()].some(answer => {

            return answer.status === "queued";
        })) {
            throw new OperationError(IpcErrorCode.Busy, "Wait for the submitted canvas answer to continue.");
        }

        return this.#prompt(entry, text, undefined, task);
    }

    /** Capture the submitted execution ID; never relabel a late call as the current run. */
    authorizeExecution(id: string, executionId: string): () => boolean {

        const entry = this.#entries.get(id);
        const execution = entry?.execution;

        return () => {

            return !!entry && this.#entries.get(id) === entry && !this.#ended(entry)
            && !!execution && execution.id === executionId && execution.phase === "active" && entry.execution === execution;
        };
    }

    enqueue(text: string, id: string): {
        id: string;
    } {

        const entry = this.#entry(id);
        if (!text.trim() || text.length > 32000 || this.#ended(entry) || entry.configuring
            || entry.execution?.phase === "cancelled" || entry.queue.length >= 16) {
            throw new OperationError(IpcErrorCode.InvalidArgument, "Cannot queue this supplemental request.");
        }
        const item = {
            id: randomUUID(),
            text: text.trim(),
        };
        entry.queue.push(item);
        this.changed({
            type: "updated",
            id,
        });
        this.#drain(entry);

        return { id: item.id };
    }

    #drain(entry: SessionEntry): void {

        if (this.#ended(entry) || entry.execution || entry.continuing || entry.waitingQuestion || entry.configuring
            || [...entry.answers.values()].some(answer => {

                return answer.status === "queued";
            })) {
            return;
        }
        const next = entry.queue.shift();
        if (next) {
            void this.#prompt(entry, next.text).catch(() => {
            });
        }
    }

    cancelTurn(id: string): Promise<void> {

        const entry = this.#entry(id);
        entry.queue.length = 0;
        for (const answer of entry.answers.values()) {
            if (answer.status === "queued" || answer.status === "running") {
                answer.status = "unavailable";
            }
        }
        entry.waitingQuestion = undefined;
        entry.continuing = undefined;
        entry.summary = {
            ...entry.summary,
            waitingForAnswer: false,
        };
        const execution = entry.execution;
        if (!execution) {
            entry.turnId = undefined;
            this.changed({
                type: "updated",
                id,
            });

            return Promise.resolve();
        }
        if (execution.cancellation) {
            return execution.cancellation;
        }
        execution.phase = "cancelled";
        entry.turnId = undefined;
        setExecutionStatus(entry, execution, "cancelling");
        this.changed({
            type: "updated",
            id,
        });
        execution.cancellation = cancelSessionExecution(entry, execution, {
            timeoutMs: this.cancellationTimeoutMs,
            detach: candidate => {

                this.#connections.detach(candidate);
            },
            record: (candidate, event) => {

                this.#record(candidate, event);
            },
        });

        return execution.cancellation;
    }

    questionOwner(id: string): BlockQuestionOwner | undefined {

        return this.#continuations.questionOwner(id);
    }

    questionActive(owner: BlockQuestionOwner, pending: boolean): boolean {

        return this.#continuations.questionActive(owner, pending);
    }

    waitForAnswer(owner: BlockQuestionOwner, key: string, waiting: boolean): void {

        return void this.#continuations.waitForAnswer(owner, key, waiting);
    }

    continuationStatus(owner: BlockQuestionOwner, id: string): AnswerContinuationStatus {

        return this.#continuations.continuationStatus(owner, id);
    }

    respond(owner: BlockQuestionOwner, id: string, text: string, active: () => Promise<boolean>): AnswerContinuationStatus {

        return this.#continuations.respond(owner, id, text, active);
    }

    #prompt(entry: SessionEntry, text: string, continuation?: AnswerContinuation, task?: SessionTaskResult): Promise<void> {

        return runSessionPrompt(entry, text, continuation, {
            ...(task ? { task } : {}),
            disposed: () => {

                return this.#disposed;
            },
            ended: candidate => {

                return this.#ended(candidate);
            },
            runningCount: () => {

                return [...this.#entries.values()].filter(candidate => {

                    return candidate.summary.status === "running";
                }).length;
            },
            hasEntry: id => {

                return this.#entries.has(id);
            },
            prepare: candidate => {

                return this.#connections.prepare(candidate);
            },
            record: (candidate, event) => {

                this.#record(candidate, event);
            },
            changed: change => {

                this.changed(change);
            },
            resume: candidate => {

                return this.#continuations.resume(candidate);
            },
        });
    }

    #canConfigure(entry: SessionEntry): boolean {

        const hasPendingWork = entry.execution !== undefined || entry.continuing !== undefined
            || entry.queue.length > 0 || entry.waitingQuestion !== undefined;
        const connectionBusy = entry.connection.status === "preparing" || entry.configuring;

        return !this.#ended(entry) && !hasPendingWork && !connectionBusy;
    }

    async cancel(id?: string): Promise<void> {

        const entry = await this.#resolve(id);
        this.#stop(entry);
        this.#record(entry, {
            type: "status",
            status: "disconnected",
        });
    }
    #stop(entry: SessionEntry): void {

        entry.queue.length = 0;
        if (entry.execution) {
            entry.execution.phase = "cancelled";
            entry.execution.abort();
        }
        entry.summary = {
            ...entry.summary,
            status: "stopped",
            waitingForAnswer: false,
        };
        entry.waitingQuestion = undefined;
        // Termination also covers adapters that never acknowledge Agent cancellation.
        void entry.host?.cancel().catch(() => {
        });
        this.#connections.detach(entry);
    }
    async remove(id: string): Promise<void> {

        const entry = this.#entry(id);
        this.#stop(entry);
        this.#entries.delete(id);
        if (this.#selectedId === id) {
            this.#selectedId = undefined;
        }
        this.changed({
            type: "removed",
            id,
        });
    }
    async getSettings(): Promise<AgentSettings> {

        const entry = await this.#resolve();

        return (await this.#connections.host(entry)).getSettings();
    }
    async selectProvider(id: string): Promise<void> {

        const entry = await this.#resolve();
        if (entry.route.providerId === id) {
            return;
        }
        const created = await this.create(entry.summary.tier, entry.origin, {
            providerId: id,
            modelId: "",
            effortId: "",
        });
        await this.connect(created.id);
    }
    async selectModel(id: string): Promise<void> {

        const entry = await this.#resolve();
        await this.configureSession(entry.summary.id, {
            ...entry.route,
            modelId: id,
        });
    }
    async selectEffort(id: string): Promise<void> {

        const entry = await this.#resolve();
        await this.configureSession(entry.summary.id, {
            ...entry.route,
            effortId: id,
        });
    }
    async configureSession(id: string, route: AgentTierRoute): Promise<void> {

        const entry = this.#entry(id);
        if (entry.route.providerId !== route.providerId) {
            throw new OperationError(IpcErrorCode.InvalidArgument, "A different Agent requires a new conversation.");
        }
        if (!this.#canConfigure(entry)) {
            throw new OperationError(IpcErrorCode.Busy, "Wait for this conversation to become idle before changing its model.");
        }
        entry.configuring = true;
        let host: SessionHost | undefined;
        try {
            host = await this.#connections.prepare(entry);
            const settings = await host.getSettings();
            if (route.modelId && settings.modelId !== route.modelId) {
                await host.selectModel(route.modelId);
            }
            if (route.effortId && (await host.getSettings()).effortId !== route.effortId) {
                await host.selectEffort(route.effortId);
            }
        } finally {
            // Retain the actual selection even if a later configuration step fails.
            try {
                if (host) {
                    const actual = await host.getSettings();
                    entry.route = {
                        providerId: actual.providerId,
                        modelId: actual.modelId ?? "",
                        effortId: actual.effortId ?? "",
                    };
                    entry.summary = {
                        ...entry.summary,
                        route: entry.route,
                    };
                    this.changed({
                        type: "updated",
                        id,
                    });
                }
            } finally {
                entry.configuring = false;
            }
        }
    }
    async configureProvider(id: string, save: () => Promise<void>): Promise<void> {

        if ([...this.#entries.values()].some(entry => {

            return entry.route.providerId === id && (entry.summary.status === "running" || entry.connection.status === "preparing");
        })) {
            throw new OperationError(IpcErrorCode.Busy, "Stop sessions using this Agent before changing its installation.");
        }
        await save();
        for (const entry of this.#entries.values()) {
            if (entry.route.providerId === id && entry.host) {
                await this.cancel(entry.summary.id);
            }
        }
        this.publishSettings();
    }
    publishSettings(): void {

        for (const entry of this.#entries.values()) {
            entry.host?.publishSettings();
        }
    }
    subscribe(listener: (event: AgentEvent) => void): () => void {

        this.#listeners.add(listener);

        return () => {

            this.#listeners.delete(listener);
        };
    }
    dispose(): void {

        this.#disposed = true;
        for (const entry of this.#entries.values()) {
            this.#stop(entry);
        }
        this.#entries.clear();
        this.#listeners.clear();
    }
    #ended(entry: SessionEntry): boolean {

        return entry.summary.status === "stopped" || this.#disposed;
    }
    #entry(id: string): SessionEntry {

        const entry = this.#entries.get(id);
        if (!entry) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Agent session is unavailable.");
        }

        return entry;
    }
    async #resolve(id?: string): Promise<SessionEntry> {

        return this.#entry(id ?? this.#selectedId ?? (await this.create()).id);
    }
    #legacy(event: AgentEvent): void {

        for (const listener of this.#listeners) {
            listener(event);
        }
    }
    #record(entry: SessionEntry, event: AgentEvent): void {

        if (this.#entries.get(entry.summary.id) !== entry) {
            return;
        }
        recordSessionEvent(entry, event);
        if (entry.summary.id === this.#selectedId) {
            this.#legacy(event);
        }
        this.changed({
            type: "updated",
            id: entry.summary.id,
        });
    }
}

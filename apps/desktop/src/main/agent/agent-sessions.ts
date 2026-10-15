/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description In-memory lifecycle and transcripts for independent ACP sessions
 */

import type { AgentSessionsChange, AgentSessionSnapshot, AgentSessionSummary, AgentTierRoute } from "../../shared/agent/sessions";
import type { AcpAgentHost } from "./acp-agent-host";
import type { AgentPreferences } from "./agent-preferences";
import type { AgentEvent, AgentSettings, AgentTier } from "@avesd/plugin-api";
import type { BlockQuestionOwner, DashboardScope } from "@avesd/workspace-model";
import { randomUUID } from "node:crypto";

type SessionHost = Pick<AcpAgentHost, "connect" | "prompt" | "continuePrompt" | "continuationToken" | "cancel" | "getSettings" | "selectProvider" | "selectModel" | "selectEffort" | "publishSettings" | "subscribe" | "dispose">;
export type AnswerContinuationStatus = "queued" | "running" | "completed" | "error" | "unavailable";
interface AnswerContinuation {
    readonly id: string;
    readonly owner: BlockQuestionOwner;
    readonly text: string;
    readonly active: () => Promise<boolean>;
    status: AnswerContinuationStatus;
    turnId?: string;
}
export interface SessionOrigin extends DashboardScope {
    readonly kind: "interactive" | "background";
    readonly source: string;
    readonly widgetId?: string;
    readonly pluginId?: string;
}
interface Entry {
    summary: AgentSessionSummary;
    readonly origin: SessionOrigin;
    route: AgentTierRoute;
    readonly events: {
        sequence: number;
        event: AgentEvent;
    }[];
    sequence: number;
    bytes: number;
    settings?: AgentSettings;
    host?: SessionHost;
    release?: () => void;
    preparing?: Promise<SessionHost>;
    stopped: boolean;
    ready: boolean;
    configuring: boolean;
    turnId?: string;
    waitingQuestion?: string;
    readonly answers: Map<string, AnswerContinuation>;
    continuing?: AnswerContinuation;
}

export class AgentSessions {
    readonly #entries = new Map<string, Entry>();
    readonly #listeners = new Set<(event: AgentEvent) => void>();
    #selectedId?: string;
    #disposed = false;
    constructor(
        readonly preferences: AgentPreferences,
        private readonly origin: () => Promise<SessionOrigin>,
        private readonly factory: (origin: SessionOrigin, route: AgentTierRoute, sessionId: string) => Promise<{
            host: SessionHost;
            release(): void;
        }>,
        private readonly changed: (change: AgentSessionsChange) => void,
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
            throw new Error("Agent session is unavailable.");
        }

        return snapshot;
    }
    snapshot(id: string): AgentSessionSnapshot | null {

        const entry = this.#entries.get(id);
        if (!entry) {
            return null;
        }

        return {
            ...entry.summary,
            events: entry.events,
            settings: entry.settings,
        };
    }
    owner(id: string): SessionOrigin {

        return this.#entry(id).origin;
    }

    async create(tier: AgentTier = "flagship", origin?: SessionOrigin, route?: AgentTierRoute): Promise<{
        id: string;
    }> {

        const resolved = origin ?? await this.origin();
        if (this.#disposed || this.#entries.size >= 32) {
            throw new Error("Close an existing session before creating another (limit 32).");
        }
        const id = randomUUID();
        const entry: Entry = {
            origin: resolved,
            route: { ...(route ?? this.preferences.routes[tier]) },
            events: [],
            sequence: 0,
            bytes: 0,
            stopped: false,
            ready: false,
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
        for (const { event } of entry.events) {this.#legacy(event);}
        this.changed({
            type: "selectionChanged",
            id,
        });
    }
    async connect(id?: string): Promise<void> {

        const entry = await this.#resolve(id);
        await this.#prepare(entry);
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

        const entry = await this.#resolve(id);
        if (entry.configuring) {
            throw new Error("Wait for the Agent configuration change to finish.");
        }
        if (entry.continuing || [...entry.answers.values()].some(answer => {

            return answer.status === "queued";
        })) {
            throw new Error("Wait for the submitted canvas answer to continue.");
        }

        return this.#prompt(entry, text);
    }

    questionOwner(id: string): BlockQuestionOwner | undefined {

        const entry = this.#entries.get(id);
        const connectionId = entry?.host?.continuationToken();

        return entry && !this.#ended(entry) && entry.summary.kind === "interactive" && entry.summary.status === "running"
            && entry.turnId && connectionId ? {
                sessionId: id,
                connectionId,
                turnId: entry.turnId,
            } : undefined;
    }

    questionActive(owner: BlockQuestionOwner, pending: boolean): boolean {

        const entry = this.#entries.get(owner.sessionId);

        return !!entry && !this.#ended(entry) && entry.host?.continuationToken() === owner.connectionId
            && (!pending || entry.turnId === owner.turnId);
    }

    waitForAnswer(owner: BlockQuestionOwner, key: string, waiting: boolean): void {

        const entry = this.#entries.get(owner.sessionId);
        if (!entry || (waiting ? !this.questionActive(owner, true) : entry.waitingQuestion !== key)) {
            return;
        }
        entry.waitingQuestion = waiting ? key : undefined;
        entry.summary = {
            ...entry.summary,
            waitingForAnswer: waiting,
        };
        this.changed({
            type: "updated",
            id: owner.sessionId,
        });
    }

    continuationStatus(owner: BlockQuestionOwner, id: string): AnswerContinuationStatus {

        if (!this.questionActive(owner, false)) {
            return "unavailable";
        }

        const entry = this.#entries.get(owner.sessionId)!;
        const answer = entry.answers.get(id);

        return answer?.status === "error" && entry.turnId !== answer.turnId ? "unavailable" : answer?.status ?? "unavailable";
    }

    /** Register after the answer is durably saved; never hold the block action open. */
    respond(owner: BlockQuestionOwner, id: string, text: string, active: () => Promise<boolean>): AnswerContinuationStatus {

        if (!this.questionActive(owner, false)) {
            throw new Error("The original ACP conversation has ended.");
        }
        const entry = this.#entry(owner.sessionId);
        const previous = entry.answers.get(id);
        if (previous && previous.status !== "error") {
            return previous.status;
        }
        if (previous && entry.turnId !== previous.turnId) {
            throw new Error("This answer has been superseded by another turn.");
        }
        if (!previous && !this.questionActive(owner, true)) {
            throw new Error("The question belongs to an earlier turn.");
        }
        if (!previous && entry.answers.size >= 64) {
            throw new Error("This session has reached its canvas answer limit.");
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
        this.changed({
            type: "updated",
            id: owner.sessionId,
        });
        void this.#continue(entry);

        return "queued";
    }

    async #continue(entry: Entry): Promise<void> {

        if (this.#ended(entry) || entry.summary.status === "running" || entry.continuing) {
            return;
        }
        const answer = [...entry.answers.values()].find(candidate => {

            return candidate.status === "queued";
        });
        if (!answer) {
            return;
        }
        entry.continuing = answer;
        try {
            if (!this.questionActive(answer.owner, false) || !await answer.active()) {
                answer.status = "unavailable";

                return;
            }
            answer.status = "running";
            await this.#prompt(entry, answer.text, answer);
            answer.status = "completed";
        } catch {
            answer.status = this.questionActive(answer.owner, false) ? "error" : "unavailable";
        } finally {
            entry.continuing = undefined;
            this.changed({
                type: "updated",
                id: entry.summary.id,
            });
            void this.#continue(entry);
        }
    }

    async #prompt(entry: Entry, text: string, continuation?: AnswerContinuation): Promise<void> {

        if (entry.stopped || entry.summary.status === "running" || this.#disposed) {
            throw new Error("This session is stopped or already responding.");
        }
        entry.turnId = randomUUID();
        entry.waitingQuestion = undefined;
        if (continuation) {
            continuation.turnId = entry.turnId;
        }
        entry.summary = {
            ...entry.summary,
            status: "running",
            waitingForAnswer: false,
        };
        this.#record(entry, {
            type: "userMessage",
            text,
        });
        this.#record(entry, { type: "turnStarted" });
        try {
            if ([...this.#entries.values()].filter(item => {

                return item.summary.status === "running";
            }).length > 8) {
                throw new Error("At most eight agent tasks can run concurrently.");
            }
            const host = continuation ? entry.host : await this.#prepare(entry);
            if (this.#ended(entry)) {
                return;
            }
            if (!host) {
                throw new Error("The original ACP conversation has ended.");
            }
            if (continuation) {
                await host.continuePrompt(text, continuation.owner.connectionId);
            }
            else {
                await host.prompt(text);
            }
            if (!this.#ended(entry)) {
                entry.summary = {
                    ...entry.summary,
                    status: "completed",
                };
            }
        } catch {
            if (!this.#ended(entry)) {
                entry.summary = {
                    ...entry.summary,
                    status: "error",
                };
                if (entry.settings?.status !== "error") {
                    this.#record(entry, {
                        type: "status",
                        status: "error",
                        message: "Agent task failed. Check the configured ACP, model, effort and local login.",
                    });
                }
            }
            throw new Error("Agent task failed.");
        } finally {
            if (this.#entries.has(entry.summary.id)) {
                this.changed({
                    type: "updated",
                    id: entry.summary.id,
                });
            }
            if (!continuation) {
                void this.#continue(entry);
            }
        }
    }
    async cancel(id?: string): Promise<void> {

        const entry = await this.#resolve(id);
        this.#stop(entry);
        this.#record(entry, {
            type: "status",
            status: "disconnected",
        });
    }
    #stop(entry: Entry): void {

        entry.stopped = true;
        entry.summary = {
            ...entry.summary,
            status: "stopped",
            waitingForAnswer: false,
        };
        entry.waitingQuestion = undefined;
        // Termination also covers adapters that never acknowledge ACP cancellation.
        void entry.host?.cancel().catch(() => {
        });
        entry.host?.dispose(); entry.release?.(); entry.host = undefined; entry.release = undefined;
    }
    async remove(id: string): Promise<void> {

        const entry = this.#entry(id);
        this.#stop(entry); this.#entries.delete(id);
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

        return (await this.#host(entry)).getSettings();
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
            throw new Error("A different ACP requires a new conversation.");
        }
        if (entry.summary.status === "running" || entry.preparing || entry.configuring || entry.continuing || entry.waitingQuestion || this.#ended(entry)) {
            throw new Error("Wait for this conversation to become idle before changing its model.");
        }
        entry.configuring = true;
        let host: SessionHost | undefined;
        try {
            host = await this.#prepare(entry);
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
            } finally { entry.configuring = false; }
        }
    }
    async configureProvider(id: string, save: () => Promise<void>): Promise<void> {

        if ([...this.#entries.values()].some(entry => {

            return entry.route.providerId === id && (entry.summary.status === "running" || !!entry.preparing);
        })) {
            throw new Error("Stop sessions using this ACP before changing its installation.");
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

        for (const entry of this.#entries.values()) {entry.host?.publishSettings();}
    }
    subscribe(listener: (event: AgentEvent) => void): () => void {

        this.#listeners.add(listener);

        return () => {

            this.#listeners.delete(listener);
        };
    }
    dispose(): void {

        this.#disposed = true;
        for (const entry of this.#entries.values()) { entry.stopped = true; entry.host?.dispose(); entry.release?.(); }
        this.#entries.clear(); this.#listeners.clear();
    }
    #ended(entry: Entry): boolean {

        return entry.stopped || this.#disposed;
    }
    #entry(id: string): Entry {

        const entry = this.#entries.get(id);
        if (!entry) {
            throw new Error("Agent session is unavailable.");
        }

        return entry;
    }
    async #resolve(id?: string): Promise<Entry> {

        return this.#entry(id ?? this.#selectedId ?? (await this.create()).id);
    }
    async #host(entry: Entry): Promise<SessionHost> {

        if (this.#ended(entry)) {
            throw new Error("Agent session has ended.");
        }
        if (entry.host) {
            return entry.host;
        }
        const created = await this.factory(entry.origin, entry.route, entry.summary.id);
        if (this.#ended(entry)) {
            created.host.dispose(); created.release(); throw new Error("Agent session has ended.");
        }
        // A simultaneous settings query may have created the host first.
        const existing = this.#entries.get(entry.summary.id)?.host;
        if (existing) {
            created.host.dispose(); created.release();

            return existing;
        }
        entry.host = created.host; entry.release = created.release;
        created.host.subscribe(event => {

            if (!this.#ended(entry)) {
                this.#record(entry, event);
            }
        });

        return created.host;
    }
    #prepare(entry: Entry): Promise<SessionHost> {

        if (entry.ready && entry.host) {
            return Promise.resolve(entry.host);
        }
        if (!entry.preparing) {
            entry.preparing = (async () => {

                const host = await this.#host(entry);
                await host.connect();
                const settings = await host.getSettings();
                if (entry.route.modelId && settings.modelId !== entry.route.modelId) {
                    await host.selectModel(entry.route.modelId);
                }
                if (entry.route.effortId && (await host.getSettings()).effortId !== entry.route.effortId) {
                    await host.selectEffort(entry.route.effortId);
                }
                entry.ready = true;

                return host;
            })().finally(() => {

                entry.preparing = undefined;
            });
        }

        return entry.preparing;
    }
    #legacy(event: AgentEvent): void {

        for (const listener of this.#listeners) {listener(event);}
    }
    #record(entry: Entry, event: AgentEvent): void {

        if (this.#entries.get(entry.summary.id) !== entry) {
            return;
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
            entry.ready = false;
        }
        if (event.type === "sessionReset" || (event.type === "status" && event.status === "disconnected")) {
            entry.waitingQuestion = undefined;
            entry.summary = {
                ...entry.summary,
                waitingForAnswer: false,
            };
        }
        if (event.type === "sessionReset") {
            entry.events.length = 0; entry.bytes = 0;
        }
        entry.events.push({
            sequence: ++entry.sequence,
            event,
        });
        entry.bytes += JSON.stringify(event).length;
        while (entry.bytes > 524288 && entry.events.length > 1) {entry.bytes -= JSON.stringify(entry.events.shift()!.event).length;}
        if (entry.summary.id === this.#selectedId) {
            this.#legacy(event);
        }
        this.changed({
            type: "updated",
            id: entry.summary.id,
        });
    }
}

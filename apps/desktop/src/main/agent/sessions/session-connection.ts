/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Agent_Sessions
 * @description Session Connection
 */

import type { AgentTierRoute } from "../../../shared/agent/sessions";
import type { SessionHost } from "../session-host";
import type { SessionEntry, SessionOrigin } from "./session-state";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { AgentEvent } from "@avesd/plugin-api";

export type SessionHostFactory = (origin: SessionOrigin, route: AgentTierRoute, sessionId: string) => Promise<{
    host: SessionHost;
    release(): void;
}>;

interface ConnectionContext {
    readonly factory: SessionHostFactory;
    readonly ended: (entry: SessionEntry) => boolean;
    readonly getEntry: (id: string) => SessionEntry | undefined;
    readonly record: (entry: SessionEntry, event: AgentEvent) => void;
}

export class SessionConnections {
    constructor(private readonly context: ConnectionContext) {}

    detach(entry: SessionEntry): void {

        entry.generation++;
        const host = entry.host;
        entry.host = undefined;
        host?.dispose();
        entry.release?.();
        entry.release = undefined;
        entry.connection = { status: "unprepared" };
    }

    async host(entry: SessionEntry): Promise<SessionHost> {

        if (this.context.ended(entry)) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Agent session has ended.");
        }
        if (entry.host) {
            return entry.host;
        }
        const generation = entry.generation;
        const created = await this.context.factory(entry.origin, entry.route, entry.summary.id);
        if (this.context.ended(entry) || entry.generation !== generation) {
            created.host.dispose();
            created.release();
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Agent session has ended.");
        }
        // A simultaneous settings query may have created the host first.
        const existing = this.context.getEntry(entry.summary.id)?.host;
        if (existing) {
            created.host.dispose();
            created.release();

            return existing;
        }
        entry.host = created.host;
        entry.release = created.release;
        created.host.subscribe(event => {

            if (!this.context.ended(entry) && entry.host === created.host && entry.execution?.phase !== "cancelled") {
                this.context.record(entry, event);
            }
        });

        return created.host;
    }
    prepare(entry: SessionEntry): Promise<SessionHost> {

        if (entry.connection.status === "ready" && entry.host) {
            return Promise.resolve(entry.host);
        }
        if (entry.connection.status !== "preparing") {
            const generation = entry.generation;
            const promise = (async () => {

                const host = await this.host(entry);
                await host.connect();
                const settings = await host.getSettings();
                if (entry.route.modelId && settings.modelId !== entry.route.modelId) {
                    await host.selectModel(entry.route.modelId);
                }
                if (entry.route.effortId && (await host.getSettings()).effortId !== entry.route.effortId) {
                    await host.selectEffort(entry.route.effortId);
                }
                if (entry.generation !== generation || this.context.ended(entry)) {
                    throw new OperationError(IpcErrorCode.ServiceNotReady, "Agent connection was released.");
                }
                entry.connection = { status: "ready" };

                return host;
            })().finally(() => {

                if (entry.generation === generation && entry.connection.status === "preparing") {
                    entry.connection = { status: "unprepared" };
                }
            });
            entry.connection = {
                status: "preparing",
                promise,
            };
        }

        return entry.connection.promise;
    }
}

/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Agent_Sessions
 * @description Session State
 */

import type { AgentSessionSummary, AgentTierRoute } from "../../../shared/agent/sessions";
import type { SessionHost } from "../session-host";
import type { AgentEvent, AgentSettings } from "@avesd/plugin-api";
import type { BlockQuestionOwner, DashboardScope } from "@avesd/workspace-model";

export type AnswerContinuationStatus = "queued" | "running" | "completed" | "error" | "unavailable";
export interface AnswerContinuation {
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
export interface Execution {
    readonly id: string;
    phase: "preparing" | "active" | "cancelled" | "settled";
    readonly finished: Promise<void>;
    finish(): void;
    readonly aborted: Promise<void>;
    abort(): void;
    cancellation?: Promise<void>;
}
type ConnectionState = {
    readonly status: "unprepared";
} | {
    readonly status: "preparing";
    readonly promise: Promise<SessionHost>;
} | {
    readonly status: "ready";
};

export interface SessionEntry {
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
    connection: ConnectionState;
    generation: number;
    execution?: Execution;
    readonly queue: {
        id: string;
        text: string;
    }[];
    configuring: boolean;
    turnId?: string;
    waitingQuestion?: string;
    readonly answers: Map<string, AnswerContinuation>;
    continuing?: AnswerContinuation;
}

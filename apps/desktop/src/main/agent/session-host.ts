import type { AgentEvent, AgentSettings } from "@avesd/plugin-api";

export interface SessionHost {
    connect(): Promise<void>;
    prompt(text: string, executionId?: string): Promise<void>;
    continuePrompt(text: string, connectionId: string, executionId?: string): Promise<void>;
    continuationToken(): string | undefined;
    cancel(): Promise<void>;
    getSettings(): Promise<AgentSettings>;
    selectProvider(id: string): Promise<void>;
    selectModel(id: string): Promise<void>;
    selectEffort(id: string): Promise<void>;
    publishSettings(): void;
    subscribe(listener: (event: AgentEvent) => void): () => void;
    dispose(): void;
}

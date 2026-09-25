import type { CanvasCommand, CanvasState, DashboardScope } from "@avesd/workspace-model";

export const canvasChannels = {
    inspect: "canvas:inspect",
    apply: "canvas:apply",
} as const;

export interface CanvasApi {
    inspect(scope: DashboardScope): Promise<CanvasState>;
    apply(scope: DashboardScope, command: CanvasCommand): Promise<CanvasState>;
    subscribe(listener: () => void): () => void;
}

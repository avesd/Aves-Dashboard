import type { CanvasOperation, CanvasState } from "@avesd/workspace-model";
import * as z from "zod";

const identifier = z.string().min(1)
    .max(160);
const title = z.string().trim()
    .min(1)
    .max(200);
export const canvasRequestSchema = z.discriminatedUnion("type", [
    z.strictObject({
        type: z.literal("list"),
        query: z.string().max(200)
            .optional(),
        cursor: identifier.optional(),
        limit: z.number().int()
            .min(1)
            .max(100)
            .optional(),
    }),
    z.strictObject({
        type: z.literal("read"),
        canvasId: identifier,
    }),
    z.strictObject({
        type: z.literal("create"),
        requestId: identifier,
        title,
    }),
    z.strictObject({
        type: z.literal("rename"),
        requestId: identifier,
        canvasId: identifier,
        expectedRevision: z.number().int()
            .nonnegative(),
        title,
    }),
    z.strictObject({
        type: z.literal("apply"),
        requestId: identifier,
        canvasId: identifier,
        expectedRevision: z.number().int()
            .nonnegative(),
        operations: z.array(z.record(z.string(), z.unknown())).min(1)
            .max(50),
    }),
    z.strictObject({
        type: z.literal("receipt"),
        requestId: identifier,
    }),
]);
export type CanvasRequest = z.infer<typeof canvasRequestSchema>;
export interface CanvasSummary {
    readonly id: string;
    readonly title: string;
    readonly revision: number;
    readonly updatedAt: number | null;
}
export interface CanvasDocument extends CanvasSummary {
    readonly canUndo: boolean;
    readonly schemaVersion: CanvasState["schemaVersion"];
    readonly items: CanvasState["items"];
    readonly links: CanvasState["links"];
}
export interface CanvasListing {
    readonly canvases: readonly CanvasSummary[];
    readonly nextCursor?: string;
}
export interface CanvasReceipt {
    readonly requestId: string;
    readonly canvasId: string;
    readonly revision: number;
    readonly committedAt: number;
}
export type CanvasResponse = CanvasListing | CanvasDocument | CanvasReceipt | null;
export type CanvasErrorCode = "INVALID_ARGUMENT" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "REVISION_CONFLICT" | "REQUEST_ID_REUSED" | "UNAVAILABLE";
export type CanvasResult = {
    readonly ok: true;
    readonly value: CanvasResponse;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: CanvasErrorCode;
        readonly message: string;
        readonly currentRevision?: number;
    };
};
export interface CanvasChange {
    readonly type: "canvas.created" | "canvas.changed" | "canvas.renamed" | "reset";
    readonly epoch: string;
    readonly sequence: number;
    readonly canvasId?: string;
    readonly revision?: number;
    readonly requestId?: string;
}
export interface CanvasServiceApi {
    list(input?: {
        query?: string;
        cursor?: string;
        limit?: number;
    }): Promise<CanvasListing>;
    read(canvasId: string): Promise<CanvasDocument>;
    create(requestId: string, title: string): Promise<CanvasReceipt>;
    rename(requestId: string, canvasId: string, expectedRevision: number, title: string): Promise<CanvasReceipt>;
    apply(requestId: string, canvasId: string, expectedRevision: number, operations: readonly CanvasOperation[]): Promise<CanvasReceipt>;
    receipt(requestId: string): Promise<CanvasReceipt | null>;
    subscribe(listener: (event: CanvasChange) => void): () => void;
}
export const canvasServiceChannels = {
    request: "canvas-service:request",
    changed: "canvas-service:changed",
} as const;
export function unwrapCanvasResult(result: CanvasResult): CanvasResponse {

    if (!result.ok) {
        throw new Error(`${result.error.code}: ${result.error.message}`);
    }

    return result.value;
}

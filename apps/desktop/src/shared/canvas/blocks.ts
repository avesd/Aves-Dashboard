import type { BlockData, BlockQuestion, DashboardBlock } from "@avesd/workspace-model";
import { blockChangeSchema, blockDataSchema, blockIdSchema, blockRevisionSchema } from "@avesd/workspace-model";
import * as z from "zod";

export const renderBlocksSchema = z.strictObject({
    canvasId: z.string().min(1)
        .max(160),
    requestId: z.string().min(1)
        .max(160),
    expectedRevision: blockRevisionSchema,
    changes: z.array(blockChangeSchema).min(1)
        .max(50),
});
export const inspectBlocksSchema = z.strictObject({
    canvasId: z.string().min(1)
        .max(160),
    blockIds: z.array(blockIdSchema).max(64)
        .optional(),
    include: z.array(z.enum([
        "source",
        "data",
        "actions",
        "layout",
        "screenshot",
        "errors",
    ])).max(6)
        .default([
            "data",
            "actions",
            "layout",
            "errors",
        ]),
});
export const capabilitiesSchema = z.strictObject({
    canvasId: z.string().min(1)
        .max(160),
    kind: z.enum([
        "data",
        "actions",
        "all",
    ]).default("all"),
    capabilityId: z.string().max(160)
        .optional(),
});
export const blockRuntimeRequestSchema = z.discriminatedUnion("type", [
    z.strictObject({
        type: z.literal("mount_canvas"),
    }),
    z.strictObject({
        type: z.literal("release_canvas"),
        sandboxId: z.uuid(),
    }),
    z.strictObject({
        type: z.literal("snapshots"),
        sandboxId: z.uuid(),
    }),
    z.strictObject({
        type: z.literal("mount"),
        canvasId: z.string().min(1)
            .max(160),
        blockId: blockIdSchema,
        generation: z.uuid(),
        revision: blockRevisionSchema,
    }),
    z.strictObject({
        type: z.literal("snapshot"),
        leaseId: z.uuid(),
    }),
    z.strictObject({
        type: z.literal("release"),
        leaseId: z.uuid(),
    }),
    z.strictObject({
        type: z.literal("report"),
        leaseId: z.uuid(),
        status: z.enum([
            "loading",
            "ready",
            "error",
        ]),
        error: z.enum([
            "SCRIPT_ERROR",
            "LOAD_TIMEOUT",
            "DOCUMENT_ERROR",
        ]).optional(),
        rect: z.strictObject({
            x: z.number().int(),
            y: z.number().int(),
            width: z.number().int()
                .min(0)
                .max(8000),
            height: z.number().int()
                .min(0)
                .max(8000),
        }).optional(),
    }),
    z.strictObject({
        type: z.literal("action"),
        leaseId: z.uuid(),
        requestId: z.uuid(),
        actionId: blockIdSchema,
        input: blockDataSchema.default({}),
        expectedDataRevision: blockRevisionSchema,
        expectedQuestionRevision: blockRevisionSchema.optional(),
    }),
    z.strictObject({
        type: z.literal("state"),
        leaseId: z.uuid(),
        expectedStateRevision: blockRevisionSchema,
        state: blockDataSchema,
    }),
]);
export type BlockRuntimeRequest = z.infer<typeof blockRuntimeRequestSchema>;
export interface BlockActionResult {
    readonly executionId: string;
    readonly actionId: string;
    readonly status: "running" | "completed" | "error";
    readonly result?: BlockData;
    readonly taskId?: string;
}
export interface BlockSnapshot {
    readonly data: BlockData;
    readonly dataRevision: number;
    readonly bindings: Readonly<Record<string, BlockData>>;
    readonly viewState: BlockData;
    readonly stateRevision: number;
    readonly actions: readonly BlockActionResult[];
    readonly sampledAt: number;
    readonly question?: {
        readonly id: string;
        readonly title: string;
        readonly fields: BlockQuestion["fields"];
        readonly revision: number;
        readonly status: "pending" | "answered" | "unavailable";
        readonly answers?: BlockData;
        readonly submissionId?: string;
        readonly continuation?: "queued" | "running" | "completed" | "error" | "unavailable";
        readonly canRetry: boolean;
    };
}
export interface BlockMount {
    readonly leaseId: string;
    readonly revision: number;
    readonly snapshot: BlockSnapshot;
}
export interface CanvasSandboxMount {
    readonly sandboxId: string;
    readonly url: string;
}
export interface BlockSnapshotDelivery {
    readonly leaseId: string;
    readonly snapshot: BlockSnapshot;
}
export type BlockRuntimeResponse = BlockMount | CanvasSandboxMount | readonly BlockSnapshotDelivery[] | BlockSnapshot | BlockActionResult | undefined;
export interface BlockRuntimeStatus {
    readonly blockId: string;
    readonly revision: number;
    readonly status: "unmounted" | "loading" | "ready" | "error";
    readonly displayedRevision?: number;
    readonly errors: readonly string[];
}
export interface DashboardBlocksApi {
    invoke(request: BlockRuntimeRequest): Promise<BlockRuntimeResponse>;
    subscribe(listener: () => void): () => void;
}
export const dashboardBlocksChannels = {
    request: "dashboard-blocks:request",
    changed: "dashboard-blocks:changed",
} as const;
export type BlockInspection = {
    readonly id: string;
    readonly revision: number;
    readonly runtime: BlockRuntimeStatus;
    readonly source?: DashboardBlock["source"];
    readonly bounds?: DashboardBlock["bounds"];
    readonly snapshot?: BlockSnapshot;
    readonly actions?: DashboardBlock["actions"];
};

export const canvasSandboxInteractionSchema = z.discriminatedUnion("kind", [
    z.strictObject({
        kind: z.literal("pan"),
        dx: z.number(),
        dy: z.number(),
    }),
    z.strictObject({
        kind: z.literal("wheel"),
        x: z.number(),
        y: z.number(),
        delta: z.number(),
    }),
    z.strictObject({
        kind: z.literal("menu"),
        x: z.number(),
        y: z.number(),
    }),
    z.strictObject({
        kind: z.literal("key"),
        command: z.enum([
            "controller",
            "reset",
            "escape",
        ]),
    }),
]);
export type CanvasSandboxInteraction = z.infer<typeof canvasSandboxInteractionSchema>;
export interface CanvasViewport {
    readonly x: number;
    readonly y: number;
    readonly zoom: number;
}

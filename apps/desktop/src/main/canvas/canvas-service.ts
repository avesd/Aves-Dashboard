/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas
 * @description Canvas Service
 */

import type { CanvasChange, CanvasDocument, CanvasErrorCode, CanvasListing, CanvasReceipt, CanvasRequest, CanvasResponse, CanvasResult } from "../../shared/canvas/contracts";
import { canvasServiceRequestSchema } from "../../shared/canvas/contracts";
import type { WorkspaceFile } from "../storage/workspace-file";
import type { BlockQuestionOwner, Dashboard, DashboardId, WorkspaceSnapshot } from "@avesd/workspace-model";
import { changeDashboardBlocks, readCanvasMetadata, readDashboardBlocks, writeCanvasMetadata, writeDashboardBlocks } from "@avesd/workspace-model";
import { createHash, randomUUID } from "node:crypto";
import * as z from "zod";

export interface CanvasAccess {
    readonly clientId: string;
    readonly isActive?: () => boolean;
    readonly canvasIds: "all" | readonly string[];
    readonly questionOwner?: BlockQuestionOwner;
}
const receiptSchema = z.object({
    requestId: z.string(),
    canvasId: z.string(),
    revision: z.number().int()
        .nonnegative(),
    committedAt: z.number(),
    blockIds: z.array(z.string()).optional(),
});
const metadataSchema = z.object({
    receipts: z.array(z.object({
        clientId: z.string(),
        fingerprint: z.string(),
        receipt: receiptSchema,
    })).default([]),
    updated: z.record(z.string(), z.number()).default({}),
});
export class CanvasServiceError extends Error {
    constructor(readonly code: CanvasErrorCode, message: string, readonly currentRevision?: number) {

        super(message);
    }
}
function allowed(access: CanvasAccess, canvasId: string): boolean {

    return access.canvasIds === "all" || access.canvasIds.includes(canvasId);
}
function findCanvas(snapshot: WorkspaceSnapshot | undefined, access: CanvasAccess, id: string): Dashboard {

    const dashboard = allowed(access, id) ? snapshot?.dashboards.find(item => {

        return item.id === id;
    }) : undefined;
    if (!dashboard) {
        throw new CanvasServiceError("NOT_FOUND", "Canvas is unavailable.");
    }

    return dashboard;
}
function summary(dashboard: Dashboard, updated: Record<string, number>) {

    return {
        id: dashboard.id,
        title: dashboard.name,
        revision: readCanvasMetadata(dashboard).revision,
        updatedAt: updated[dashboard.id] ?? null,
    };
}

/** Transport-independent application service; only its storage adapter opens files. */
export class CanvasService {
    readonly #epoch = randomUUID();
    #sequence = 0;
    readonly #listeners = new Set<(event: CanvasChange) => void>();
    constructor(private readonly file: Pick<WorkspaceFile, "readService" | "transaction">, private readonly changed: () => void = () => {
    }) {}

    subscribe(listener: (event: CanvasChange) => void): () => void {

        this.#listeners.add(listener);

        return () => {

            this.#listeners.delete(listener);
        };
    }
    reset(): CanvasChange {

        return {
            type: "reset",
            epoch: this.#epoch,
            sequence: this.#sequence,
        };
    }
    invalidate(): void {

        this.publish({ type: "reset" });
    }
    publish(event: Omit<CanvasChange, "epoch" | "sequence">): void {

        const change = {
            ...event,
            epoch: this.#epoch,
            sequence: ++this.#sequence,
        };
        for (const listener of this.#listeners) {
            try {
                listener(change);
            } catch {
                /* A disconnected observer cannot roll back a committed write. */
            }
        }
    }
    async execute(access: CanvasAccess, input: unknown): Promise<CanvasResult> {

        try {
            this.#authorize(access);
            const parsed = canvasServiceRequestSchema.safeParse(input);
            if (!parsed.success) {
                throw new CanvasServiceError("INVALID_ARGUMENT", "Invalid canvas request.");
            }
            const value = await this.#execute(access, parsed.data);

            return {
                ok: true,
                value,
            };
        } catch (error) {
            if (error instanceof CanvasServiceError) {
                return {
                    ok: false,
                    error: {
                        code: error.code,
                        message: error.message,
                        ...(error.currentRevision === undefined ? {} : { currentRevision: error.currentRevision }),
                    },
                };
            }

            return {
                ok: false,
                error: {
                    code: "UNAVAILABLE",
                    message: "Canvas storage is unavailable. Retry with the same request ID.",
                },
            };
        }
    }
    #authorize(access: CanvasAccess): void {

        if (access.isActive && !access.isActive()) {
            throw new CanvasServiceError("UNAUTHENTICATED", "Client access has ended.");
        }
    }
    async #execute(access: CanvasAccess, request: CanvasRequest): Promise<CanvasResponse> {

        if (request.type === "list" || request.type === "read" || request.type === "receipt") {
            const { snapshot, metadata: stored } = await this.file.readService();
            this.#authorize(access);
            const metadata = metadataSchema.parse(stored);
            if (request.type === "receipt") {
                const receipt = metadata.receipts.find(entry => {

                    return entry.clientId === access.clientId && entry.receipt.requestId === request.requestId;
                })?.receipt;

                return receipt && allowed(access, receipt.canvasId) ? receipt : null;
            }
            if (request.type === "read") {
                const dashboard = findCanvas(snapshot, access, request.canvasId);

                return {
                    ...summary(dashboard, metadata.updated),
                    blocks: readDashboardBlocks(dashboard),
                } satisfies CanvasDocument;
            }
            const limit = request.limit ?? 50;
            const candidates = (snapshot?.dashboards ?? []).filter(item => {

                return allowed(access, item.id)
                && (!request.query || item.name.toLowerCase().includes(request.query.toLowerCase()));
            })
                .sort((a, b) => {

                    return a.id.localeCompare(b.id);
                })
                .filter(item => {

                    return !request.cursor || item.id.localeCompare(request.cursor) > 0;
                });
            const page = candidates.slice(0, limit);

            return {
                canvases: page.map(item => {

                    return summary(item, metadata.updated);
                }),
                ...(candidates.length > limit ? { nextCursor: page.at(-1)!.id } : {}),
            } satisfies CanvasListing;
        }
        const fingerprint = createHash("sha256").update(JSON.stringify(request))
            .digest("hex");
        const committed = await this.file.transaction((snapshot, stored) => {

            if (!snapshot) {
                throw new CanvasServiceError("UNAVAILABLE", "Canvas storage is not initialized.");
            }
            this.#authorize(access);
            const metadata = metadataSchema.parse(stored);
            if (request.type === "create" && access.canvasIds !== "all") {
                throw new CanvasServiceError("FORBIDDEN", "Canvas creation is unavailable to this client.");
            }
            if (request.type !== "create") {
                findCanvas(snapshot, access, request.canvasId);
            }
            const prior = metadata.receipts.find(entry => {

                return entry.clientId === access.clientId && entry.receipt.requestId === request.requestId;
            });
            if (prior) {
                if (prior.fingerprint !== fingerprint) {
                    throw new CanvasServiceError("REQUEST_ID_REUSED", "Request ID already belongs to another command.");
                }
                if (!allowed(access, prior.receipt.canvasId)) {
                    throw new CanvasServiceError("NOT_FOUND", "Canvas is unavailable.");
                }

                return {
                    snapshot,
                    metadata,
                    result: {
                        receipt: prior.receipt,
                        duplicate: true,
                    },
                };
            }
            let dashboard: Dashboard;
            if (request.type === "create") {
                const workspace = snapshot.workspaces[0];
                if (!workspace) {
                    throw new CanvasServiceError("UNAVAILABLE", "Canvas storage is not initialized.");
                }
                dashboard = {
                    id: randomUUID() as DashboardId,
                    workspaceId: workspace.id,
                    name: request.title,
                    layoutRevision: 0,
                    viewState: {},
                };
            } else {
                dashboard = findCanvas(snapshot, access, request.canvasId);
                const state = readCanvasMetadata(dashboard);
                if (state.revision !== request.expectedRevision) {
                    throw new CanvasServiceError("REVISION_CONFLICT", "Canvas changed. Read it again before making a new command.", state.revision);
                }
                if (!Number.isSafeInteger(state.revision + 1)) {
                    throw new CanvasServiceError("INVALID_ARGUMENT", "Canvas revision is exhausted.");
                }
                if (request.type === "render") {
                    try {
                        const blocks = changeDashboardBlocks(readDashboardBlocks(dashboard), request.changes, access.questionOwner);
                        if (access.questionOwner) {
                            const pending = [
                                ...blocks,
                                ...snapshot.dashboards.filter(item => {

                                    return item.id !== dashboard.id;
                                }).flatMap(readDashboardBlocks),
                            ]
                                .filter(block => {

                                    return block.question && !block.question.submission
                                    && block.question.owner.sessionId === access.questionOwner!.sessionId
                                    && block.question.owner.turnId === access.questionOwner!.turnId;
                                });
                            if (pending.length > 1) {
                                throw new Error("Only one pending question per session turn is allowed.");
                            }
                        }
                        const next = {
                            ...dashboard,
                            viewState: writeDashboardBlocks(dashboard, blocks),
                        };
                        readDashboardBlocks(next);
                        dashboard = {
                            ...next,
                            viewState: writeCanvasMetadata(next, { revision: state.revision + 1 }),
                        };
                    } catch {
                        throw new CanvasServiceError("INVALID_ARGUMENT", "Invalid block change, binding, or data revision. Inspect the blocks and retry.");
                    }
                } else {
                    dashboard = {
                        ...dashboard,
                        name: request.title,
                        viewState: writeCanvasMetadata(dashboard, { revision: state.revision + 1 }),
                    };
                }
            }
            const receipt: CanvasReceipt = {
                requestId: request.requestId,
                canvasId: dashboard.id,
                revision: readCanvasMetadata(dashboard).revision,
                committedAt: Date.now(),
                ...(request.type === "render" ? {
                    blockIds: request.changes.map(change => {

                        return change.id;
                    }),
                } : {}),
            };
            metadata.updated[dashboard.id] = receipt.committedAt;
            metadata.receipts.push({
                clientId: access.clientId,
                fingerprint,
                receipt,
            });
            const next = {
                ...snapshot,
                dashboards: request.type === "create" ? [
                    ...snapshot.dashboards,
                    dashboard,
                ] : snapshot.dashboards.map(item => {

                    return item.id === dashboard.id ? dashboard : item;
                }),
            };

            return {
                snapshot: next,
                metadata,
                result: {
                    receipt,
                    duplicate: false,
                },
            };
        });
        if (!committed.duplicate) {
            this.publish({
                type: request.type === "create" ? "canvas.created" : request.type === "render" ? "canvas.changed" : "canvas.renamed",
                ...committed.receipt,
            });
            this.changed();
        }

        return committed.receipt;
    }
}

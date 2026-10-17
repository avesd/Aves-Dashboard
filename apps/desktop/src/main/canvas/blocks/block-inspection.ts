/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas_Blocks
 * @description Block Inspection
 */

import type { BlockInspection, BlockRuntimeStatus } from "../../../shared/canvas/blocks";
import { inspectBlocksSchema } from "../../../shared/canvas/blocks";
import type { CanvasDocument } from "../../../shared/canvas/contracts";
import type { CanvasAccess } from "../canvas-service";
import type { BlockLease } from "./block-runtime-types";
import type { BlockSnapshots } from "./block-snapshots";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { DashboardBlock } from "@avesd/workspace-model";

export class BlockInspector {
    constructor(
        private readonly leases: ReadonlyMap<string, BlockLease>,
        private readonly snapshots: BlockSnapshots,
        private readonly document: (access: CanvasAccess, canvasId: string) => Promise<CanvasDocument>,
    ) {}

    status(canvasId: string, block: DashboardBlock): BlockRuntimeStatus {

        const leases = [...this.leases.values()].filter(lease => {

            return lease.canvasId === canvasId && lease.blockId === block.id && lease.generation === block.generation && !lease.owner.isDestroyed();
        });
        const current = leases.find(lease => {

            return lease.revision === block.revision;
        });
        const displayed = leases.find(lease => {

            return lease.status === "ready";
        });

        return {
            blockId: block.id,
            revision: block.revision,
            status: current?.status ?? "unmounted",
            ...(displayed ? { displayedRevision: displayed.revision } : {}),
            errors: current?.errors ?? [],
        };
    }
    async inspect(access: CanvasAccess, input: unknown): Promise<{
        canvasId: string;
        revision: number;
        blocks: BlockInspection[];
        images: {
            blockId: string;
            data: string;
            mimeType: "image/png";
            capturedAt: number;
        }[];
    }> {

        const request = inspectBlocksSchema.parse(input);
        const canvas = await this.document(access, request.canvasId);
        const selected = request.blockIds ? request.blockIds.map(id => {

            const block = canvas.blocks.find(candidate => {

                return candidate.id === id;
            });
            if (!block) {
                throw new OperationError(IpcErrorCode.ServiceNotReady, "Block is unavailable.");
            }

            return block;
        }) : canvas.blocks;
        const images: {
            blockId: string;
            data: string;
            mimeType: "image/png";
            capturedAt: number;
        }[] = [];
        const blocks = selected.map(block => {

            return {
                id: block.id,
                revision: block.revision,
                runtime: this.status(canvas.id, block),
                ...(request.include.includes("source") ? { source: block.source } : {}),
                ...(request.include.includes("layout") ? { bounds: block.bounds } : {}),
                ...(request.include.includes("data") ? { snapshot: this.snapshots.read(canvas, block) } : {}),
                ...(request.include.includes("actions") ? { actions: block.actions } : {}),
            };
        });
        if (request.include.includes("screenshot")) {
            for (const block of selected.slice(0, 4)) {
                const lease = [...this.leases.values()].find(candidate => {

                    return candidate.canvasId === canvas.id && candidate.blockId === block.id && candidate.generation === block.generation && candidate.revision === block.revision && candidate.status === "ready" && !candidate.owner.isDestroyed();
                });
                const rect = lease?.rect;
                if (lease && rect && rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0) {
                    const image = await lease.owner.capturePage(rect);
                    const latest = await this.document(access, canvas.id);
                    if (!latest.blocks.some(candidate => {

                        return candidate.id === block.id && candidate.revision === block.revision && candidate.dataRevision === block.dataRevision;
                    })) {
                        throw new OperationError(IpcErrorCode.VersionConflict, "Block changed during capture; inspect again.");
                    }
                    images.push({
                        blockId: block.id,
                        data: image.toPNG().toString("base64"),
                        mimeType: "image/png",
                        capturedAt: Date.now(),
                    });
                }
            }
        }

        return {
            canvasId: canvas.id,
            revision: canvas.revision,
            blocks,
            images,
        };
    }
}

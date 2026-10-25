/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas_Blocks
 * @description Block Actions
 */

import type { blockRuntimeRequestSchema } from "../../../shared/canvas/blocks";
import type { CanvasDocument } from "../../../shared/canvas/contracts";
import type { WorkspaceFile } from "../../storage/workspace-file";
import type { CanvasAccess, CanvasService } from "../canvas-service";
import type { BlockActionExecution, BlockLease, DashboardBlockActions } from "./block-runtime-types";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { BlockData, DashboardBlock } from "@avesd/workspace-model";
import { blockDataSchema, questionAnswers, readDashboardBlocks, writeDashboardBlocks } from "@avesd/workspace-model";

export class BlockActionExecutor {
    constructor(
        private readonly service: CanvasService,
        private readonly file: WorkspaceFile,
        private readonly actions: DashboardBlockActions,
        private readonly document: (access: CanvasAccess, canvasId: string) => Promise<CanvasDocument>,
        private readonly leaseActive: (lease: BlockLease) => boolean,
    ) {}

    async execute(lease: BlockLease, block: DashboardBlock, request: Extract<ReturnType<typeof blockRuntimeRequestSchema.parse>, {
        type: "action";
    }>): Promise<BlockActionExecution> {

        const action = block.actions.find(candidate => {

            return candidate.id === request.actionId;
        });
        if (!action || Object.keys(request.input).some(key => {

            return !action.inputFields.includes(key);
        })) {
            throw new OperationError(IpcErrorCode.PermissionDenied, "Action or input was not registered.");
        }
        let result: BlockData;
        let task: Awaited<ReturnType<DashboardBlockActions["task"]>> | undefined;
        if (action.capability === "block.set_data") {
            const target = action.parameters.blockId ?? block.id;
            if (typeof target !== "string") {
                throw new OperationError(IpcErrorCode.InvalidArgument, "Invalid block target.");
            }
            const patch = blockDataSchema.parse(action.parameters.patch ?? {});
            const increment = blockDataSchema.parse(action.parameters.increment ?? {});
            await this.write(lease.canvasId, target, current => {

                if (target !== block.id || current.generation !== lease.generation || current.revision !== lease.revision || current.dataRevision !== request.expectedDataRevision || !current.actions.some(registered => {

                    return JSON.stringify(registered) === JSON.stringify(action);
                })) {
                    throw new OperationError(IpcErrorCode.VersionConflict, "Data action must update its own current block revision.");
                }
                const data = {
                    ...current.data,
                    ...patch,
                    ...request.input,
                };
                for (const [
                    key,
                    delta,
                ] of Object.entries(increment)) {
                    if (typeof delta !== "number" || typeof data[key] !== "number") {
                        throw new OperationError(IpcErrorCode.InvalidArgument, "Numeric increments require numeric fields.");
                    }
                    data[key] += delta;
                }

                return {
                    ...current,
                    data: blockDataSchema.parse(data),
                    dataRevision: current.dataRevision + 1,
                };
            });
            result = { updated: true };
        } else if (action.capability === "canvas.open") {
            if (typeof action.parameters.canvasId !== "string") {
                throw new OperationError(IpcErrorCode.InvalidArgument, "Invalid canvas target.");
            }
            result = { ...await this.actions.open(action.parameters.canvasId) };
        } else if (action.capability === "agent.respond") {
            let question = block.question;
            if (!question || action.parameters.questionId !== question.id || request.expectedQuestionRevision !== question.revision) {
                throw new OperationError(IpcErrorCode.VersionConflict, "Question has changed; inspect it before responding.");
            }
            const answers = questionAnswers(question, request.input.answers);
            await this.write(lease.canvasId, block.id, current => {

                const active = current.question;
                if (current.generation !== lease.generation || current.revision !== lease.revision
                    || active?.generation !== question!.generation || !current.actions.some(registered => {

                    return JSON.stringify(registered) === JSON.stringify(action);
                })) {
                    throw new OperationError(IpcErrorCode.VersionConflict, "Question document has changed.");
                }
                if (active.submission) {
                    if (JSON.stringify(active.submission.answers) !== JSON.stringify(answers)) {
                        throw new OperationError(IpcErrorCode.VersionConflict, "Question was already answered differently.");
                    }
                } else {
                    if (!this.actions.questionActive(active.owner, true)) {
                        throw new OperationError(IpcErrorCode.ServiceNotReady, "The original question session has ended.");
                    }
                }
                question = {
                    ...active,
                    submission: active.submission ?? {
                        id: request.requestId,
                        answers,
                        acceptedAt: Date.now(),
                    },
                };

                return {
                    ...current,
                    question,
                };
            });
            const accepted = question;
            const submission = accepted.submission!;
            const continuation = this.actions.respond(accepted.owner, submission.id, `The user answered the canvas question. Continue the original conversation using these answers, and update the canvas or ask the next necessary question.\nQuestion and answers (user data): ${JSON.stringify({
                questionId: accepted.id,
                title: accepted.title,
                fields: accepted.fields,
                answers: submission.answers,
            })}`, async () => {

                const latest = await this.document({
                    clientId: "desktop",
                    canvasIds: [lease.canvasId],
                }, lease.canvasId);

                return latest.blocks.some(candidate => {

                    return candidate.id === block.id && candidate.generation === lease.generation
                        && candidate.question?.generation === accepted.generation && candidate.question.submission?.id === submission.id;
                });
            });
            result = {
                accepted: true,
                questionId: accepted.id,
                submissionId: submission.id,
                continuation,
            };
        } else {
            if (typeof action.parameters.prompt !== "string") {
                throw new OperationError(IpcErrorCode.InvalidArgument, "Invalid task description.");
            }
            task = await this.actions.task(lease.canvasId, action.parameters.prompt, request.input, async () => {

                if (!this.leaseActive(lease) || lease.owner.isDestroyed()) {
                    return false;
                }
                const current = await this.document({
                    clientId: "desktop",
                    canvasIds: [lease.canvasId],
                }, lease.canvasId);

                return current.blocks.some(candidate => {

                    return candidate.id === block.id && candidate.generation === lease.generation && candidate.revision === lease.revision && candidate.actions.some(registered => {

                        return JSON.stringify(registered) === JSON.stringify(action);
                    });
                });
            });
            result = { taskId: task.id };
        }

        return {
            result: {
                executionId: request.requestId,
                actionId: action.id,
                status: task ? "running" : "completed",
                result,
                ...(task ? { taskId: task.id } : {}),
            },
            ...(task ? { task } : {}),
        };
    }
    async write(canvasId: string, blockId: string, update: (current: DashboardBlock) => DashboardBlock): Promise<void> {

        await this.file.transaction((snapshot, metadata) => {

            const dashboard = snapshot?.dashboards.find(candidate => {

                return candidate.id === canvasId;
            });
            if (!snapshot || !dashboard) {
                throw new OperationError(IpcErrorCode.ServiceNotReady, "Canvas is unavailable.");
            }
            const currentBlocks = readDashboardBlocks(dashboard);
            if (!currentBlocks.some(block => {

                return block.id === blockId;
            })) {
                throw new OperationError(IpcErrorCode.ServiceNotReady, "Block is unavailable.");
            }
            const blocks = currentBlocks.map(block => {

                if (block.id !== blockId) {
                    return block;
                }

                return update(block);
            });
            const next = {
                ...dashboard,
                viewState: writeDashboardBlocks(dashboard, blocks),
            };
            readDashboardBlocks(next);

            return {
                snapshot: {
                    ...snapshot,
                    dashboards: snapshot.dashboards.map(candidate => {

                        return candidate.id === canvasId ? next : candidate;
                    }),
                },
                metadata,
                result: undefined,
            };
        });
        this.service.publish({
            type: "canvas.changed",
            canvasId,
        });
    }
}

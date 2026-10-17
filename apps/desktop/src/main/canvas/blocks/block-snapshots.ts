/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas_Blocks
 * @description Block Snapshots
 */

import type { BlockActionResult, BlockSnapshot } from "../../../shared/canvas/blocks";
import type { CanvasDocument } from "../../../shared/canvas/contracts";
import type { DashboardBlockActions } from "./block-runtime-types";
import type { AgentTaskStatus } from "@avesd/plugin-api";
import type { BlockData, DashboardBlock } from "@avesd/workspace-model";

/** Idle tasks remain pending from the block action caller's perspective. */
function taskActionStatus(status: AgentTaskStatus): BlockActionResult["status"] {

    switch (status) {
        case "completed":
            return "completed";
        case "error":
        case "stopped":
            return "error";
        case "idle":
        case "running":
            return "running";
    }
}

export class BlockSnapshots {
    constructor(private readonly actions: DashboardBlockActions, private readonly executions: ReadonlyMap<string, BlockActionResult[]>) {}

    dynamic(block: DashboardBlock, snapshot: BlockSnapshot): boolean {

        return block.bindings.some(binding => {

            return binding.sourceId === "clock";
        })
            || snapshot.question?.status === "pending"
            || snapshot.question?.continuation === "queued" || snapshot.question?.continuation === "running"
            || snapshot.actions.some(action => {

                return action.status === "running";
            });
    }
    fingerprint({ sampledAt: _sampledAt, ...snapshot }: BlockSnapshot): string {

        return JSON.stringify(snapshot);
    }
    read(canvas: CanvasDocument, block: DashboardBlock): BlockSnapshot {

        const bindings: Record<string, BlockData> = {};
        for (const binding of block.bindings) {
            const source: BlockData = binding.sourceId === "clock" ? {
                now: Date.now(),
                iso: new Date().toISOString(),
            } : canvas.blocks.find(candidate => {

                return `block:${candidate.id}` === binding.sourceId;
            })?.data ?? {};
            bindings[binding.key] = binding.fields ? Object.fromEntries(binding.fields.filter(field => {

                return Object.hasOwn(source, field);
            }).map(field => {

                return [
                    field,
                    source[field]!,
                ];
            })) : source;
        }
        const actions = (this.executions.get(`${canvas.id}/${block.id}/${block.generation}`) ?? []).map(record => {

            if (!record.taskId) {
                return record;
            }
            const task = this.actions.taskResult(record.taskId);
            if (!task) {
                return {
                    ...record,
                    status: "error" as const,
                };
            }

            return {
                ...record,
                status: taskActionStatus(task.status),
                result: {
                    status: task.status,
                    answer: task.answer,
                },
            };
        });

        return {
            data: block.data,
            dataRevision: block.dataRevision,
            bindings,
            viewState: block.viewState,
            stateRevision: block.stateRevision,
            actions,
            sampledAt: Date.now(),
            ...(block.question ? { question: this.#questionSnapshot(block) } : {}),
        };
    }
    #questionSnapshot(block: DashboardBlock): NonNullable<BlockSnapshot["question"]> {

        const question = block.question!;
        const submission = question.submission;
        const continuation = submission ? this.actions.responseStatus(question.owner, submission.id) : undefined;
        const available = this.actions.questionActive(question.owner, !submission);

        let status: NonNullable<BlockSnapshot["question"]>["status"] = "unavailable";
        if (submission) {
            status = "answered";
        } else if (available) {
            status = "pending";
        }

        return {
            id: question.id,
            title: question.title,
            fields: question.fields,
            revision: question.revision,
            status,
            canRetry: available && continuation === "error",
            ...(submission ? {
                answers: submission.answers,
                submissionId: submission.id,
                continuation,
            } : {}),
        };
    }
}

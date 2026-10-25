/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas_Blocks
 * @description Block Runtime
 */

import type { BlockResults, BlockRuntimeRequest, BlockRuntimeResponse, BlockRuntimeStatus } from "../../../shared/canvas/blocks";
import { blockRuntimeRequestSchema, capabilitiesSchema } from "../../../shared/canvas/blocks";
import type { CanvasDocument } from "../../../shared/canvas/contracts";
import { dispatchCommand } from "../../ipc/dispatch-command";
import { canvasFailure, operationFailure } from "../../operation-failure";
import type { WorkspaceFile } from "../../storage/workspace-file";
import type { CanvasAccess, CanvasService } from "../canvas-service";
import { BlockActionExecutor } from "./block-actions";
import { BlockInspector } from "./block-inspection";
import { BlockLeases } from "./block-leases";
import type { BlockActionExecution, BlockLease, DashboardBlockActions } from "./block-runtime-types";
import { BlockSandboxes } from "./block-sandbox";
import { BlockSnapshots } from "./block-snapshots";
import type { CommandHandlers } from "@avesd/desktop-contracts/ipc-commands";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { DashboardBlock } from "@avesd/workspace-model";
import { blockDataSchema } from "@avesd/workspace-model";
import type { WebContents } from "electron";
import { randomUUID } from "node:crypto";

/** One unprivileged document per canvas; host leases still authorize each block separately. */
export type { DashboardBlockActions } from "./block-runtime-types";

export class DashboardBlockRuntime {
    readonly #leases = new BlockLeases();
    readonly #sandboxes = new BlockSandboxes();
    readonly #executions = new Map<string, BlockActionExecution[]>();
    readonly #inflight = new Set<string>();
    readonly #snapshots: BlockSnapshots;
    readonly #executor: BlockActionExecutor;
    readonly #inspector: BlockInspector;
    readonly #clock: ReturnType<typeof setInterval>;
    readonly #unsubscribe: () => void;
    constructor(private readonly service: CanvasService, file: WorkspaceFile, private readonly actions: DashboardBlockActions) {

        this.#snapshots = new BlockSnapshots(actions, this.#executions);
        this.#executor = new BlockActionExecutor(service, file, actions, (access, canvasId) => {

            return this.document(access, canvasId);
        }, lease => {

            return this.#leases.has(lease.id);
        });
        this.#inspector = new BlockInspector(this.#leases, this.#snapshots, (access, canvasId) => {

            return this.document(access, canvasId);
        });
        this.#unsubscribe = service.subscribe(change => {

            this.#leases.notify(change.canvasId);
        });
        this.#clock = setInterval(() => {

            this.#leases.notify(undefined, true);
        }, 1000);
        this.#clock.unref();
    }
    async document(access: CanvasAccess, canvasId: string): Promise<CanvasDocument> {

        const result = await this.service.execute(access, {
            type: "read",
            canvasId,
        });
        if (!result.ok) {
            throw canvasFailure(result.error);
        }
        if (!result.value || !("blocks" in result.value)) {
            throw new OperationError(IpcErrorCode.Internal, "Canvas could not be loaded.");
        }

        return result.value;
    }
    renderAccess(access: CanvasAccess): CanvasAccess {

        const owner = this.actions.questionOwner(access.clientId);

        return owner ? {
            ...access,
            questionOwner: owner,
            isActive: () => {

                return (access.isActive?.() ?? true) && this.actions.questionActive(owner, true);
            },
        } : access;
    }
    rendered(before: CanvasDocument, after: CanvasDocument): void {

        for (const block of before.blocks) {
            if (block.question) {
                this.actions.waitForAnswer(block.question.owner, block.question.generation, false);
            }
        }
        for (const block of after.blocks) {
            if (block.question && !block.question.submission) {
                this.actions.waitForAnswer(block.question.owner, block.question.generation, true);
            }
        }
    }
    async capabilities(access: CanvasAccess, input: unknown) {

        const request = capabilitiesSchema.parse(input);
        const canvas = await this.document(access, request.canvasId);
        const data = [
            {
                id: "clock",
                description: "Host clock, updated once per second.",
                fields: [
                    "now",
                    "iso",
                ],
                subscription: true,
            },
            ...canvas.blocks.map(block => {

                return {
                    id: `block:${block.id}`,
                    description: block.description || block.id,
                    fields: Object.keys(block.data),
                    subscription: true,
                };
            }),
        ];
        const actions = [
            {
                id: "block.set_data",
                description: "Patch or increment the source block data.",
                parameters: {
                    blockId: "optional source block ID",
                    patch: "optional JSON object",
                    increment: "optional object of finite numeric deltas",
                },
            },
            {
                id: "canvas.open",
                description: "Open or focus the declared local canvas.",
                parameters: { canvasId: "required canvas ID" },
            },
            {
                id: "agent.task",
                description: "Ask the user to start the declared Agent task through a trusted host dialog.",
                parameters: { prompt: "required task description; supplied input is untrusted task data" },
            },
            {
                id: "agent.respond",
                description: "Save answers to this block's question and continue its original live Agent conversation. Returns acceptance immediately; question snapshots report progress.",
                parameters: { questionId: "required ID of this block's question; inputFields must be [answers]" },
            },
        ];
        const filter = <T extends {
            id: string;
        }>(entries: T[]) => {

            return entries.filter(entry => {

                return !request.capabilityId || entry.id === request.capabilityId;
            });
        };

        return {
            canvasId: canvas.id,
            data: request.kind === "actions" ? [] : filter(data),
            actions: request.kind === "data" ? [] : filter(actions),
            bridge: "One shared canvas sandbox with a Shadow DOM root per block. window/document, common timers and document/window listeners are scoped and cleaned up on replacement. Query this block through document.getElementById/querySelector; use JS event listeners, not inline handlers; no cross-block DOM access or global variables. CSS targets html/body or :host, not :root. Code runs immediately; do not wait for load events. window.avesBlock.onData(callback), getSnapshot() (synchronous snapshot object, not a Promise), action(actionId,input), saveState(state). onData receives {data,dataRevision,bindings,viewState,stateRevision,actions,question?,sampledAt}. Respond with action(id,{answers:{fieldKey:value}}); question has status,answers,continuation,canRetry.",
        };
    }
    async validateRender(access: CanvasAccess, canvasId: string, blocks: readonly DashboardBlock[]): Promise<void> {

        for (const block of blocks) {
            for (const binding of block.bindings) {
                const source = binding.sourceId === "clock" ? {
                    now: 0,
                    iso: "",
                } : blocks.find(candidate => {

                    return `block:${candidate.id}` === binding.sourceId;
                })?.data;
                if (!source || binding.fields?.some(field => {

                    return !Object.hasOwn(source, field);
                })) {
                    throw new OperationError(IpcErrorCode.InvalidArgument, "A data binding references an unavailable source or field.");
                }
            }
            for (const action of block.actions) {
                const params = action.parameters;
                if (action.inputFields.some(field => {

                    return [
                        "blockId",
                        "canvasId",
                        "prompt",
                        "questionId",
                        "sessionId",
                    ].includes(field);
                })) {
                    throw new OperationError(IpcErrorCode.PermissionDenied, "Action input cannot replace its registered target or task.");
                }
                if (action.capability === "canvas.open") {
                    if (typeof params.canvasId !== "string") {
                        throw new OperationError(IpcErrorCode.InvalidArgument, "Canvas actions require a declared canvas ID.");
                    }
                    await this.document(access, params.canvasId);
                } else if (action.capability === "agent.respond") {
                    if (!block.question || params.questionId !== block.question.id
                        || Object.keys(params).length !== 1 || JSON.stringify(action.inputFields) !== JSON.stringify(["answers"])) {
                        throw new OperationError(IpcErrorCode.InvalidArgument, "Response actions require this block's questionId and inputFields [answers].");
                    }
                } else if (action.capability === "agent.task") {
                    if (typeof params.prompt !== "string" || !params.prompt.trim() || params.prompt.length > 16_000) {
                        throw new OperationError(IpcErrorCode.InvalidArgument, "Agent actions require a bounded task description.");
                    }
                } else {
                    if (params.blockId !== undefined && params.blockId !== block.id) {
                        throw new OperationError(IpcErrorCode.PermissionDenied, "Data actions update their own block.");
                    }
                    const patch = blockDataSchema.parse(params.patch ?? {});
                    const increments = blockDataSchema.parse(params.increment ?? {});
                    const data = {
                        ...block.data,
                        ...patch,
                    };
                    if (Object.entries(increments).some(([
                        field,
                        value,
                    ]) => {

                        return typeof value !== "number" || typeof data[field] !== "number";
                    })) {
                        throw new OperationError(IpcErrorCode.InvalidArgument, "Numeric actions require existing numeric fields.");
                    }
                }
            }
            if (block.question && !block.actions.some(action => {

                return action.capability === "agent.respond";
            })) {
                throw new OperationError(IpcErrorCode.InvalidArgument, "A question requires a response action.");
            }
        }
    }
    invoke<R extends BlockRuntimeRequest>(owner: WebContents, canvasId: string, input: R): Promise<BlockRuntimeResponse<R>>;
    async invoke(owner: WebContents, canvasId: string, input: unknown): Promise<BlockRuntimeResponse> {

        const request = blockRuntimeRequestSchema.parse(input);
        const requireSandbox = (sandboxId: string) => {

            const sandbox = this.#sandboxes.get(sandboxId);
            if (!sandbox || sandbox.owner !== owner || sandbox.canvasId !== canvasId) {
                throw new OperationError(IpcErrorCode.PermissionDenied, "Canvas sandbox has ended.");
            }
        };
        const requireLease = (leaseId: string): BlockLease => {

            const lease = this.#leases.get(leaseId);
            if (!lease || lease.owner !== owner || lease.canvasId !== canvasId) {
                throw new OperationError(IpcErrorCode.PermissionDenied, "Block lease has ended.");
            }

            return lease;
        };
        const currentBlock = async (lease: BlockLease) => {

            const canvas = await this.document({
                clientId: "desktop",
                canvasIds: [canvasId],
            }, canvasId);
            const block = canvas.blocks.find(candidate => {

                return candidate.id === lease.blockId;
            });
            if (!block || block.generation !== lease.generation) {
                throw new OperationError(IpcErrorCode.NotFound, "Block was removed.");
            }

            return {
                canvas,
                block,
            };
        };
        const activeBlock = async (lease: BlockLease) => {

            const current = await currentBlock(lease);
            if (current.block.revision !== lease.revision || lease.status !== "ready") {
                throw new OperationError(IpcErrorCode.VersionConflict, "This block version is no longer active.");
            }

            return current;
        };
        const handlers: CommandHandlers<BlockRuntimeRequest, BlockResults> = {
            mount_canvas: async () => {

                await this.document({
                    clientId: "desktop",
                    canvasIds: [canvasId],
                }, canvasId);
                if ([...this.#sandboxes.values()].some(sandbox => {

                    return sandbox.owner === owner;
                })) {
                    throw new OperationError(IpcErrorCode.Busy, "This canvas already has a sandbox.");
                }
                const sandboxId = randomUUID();
                this.#sandboxes.set(sandboxId, {
                    owner,
                    canvasId,
                });
                owner.once("destroyed", () => {

                    this.#sandboxes.delete(sandboxId);
                });

                return {
                    sandboxId,
                    url: `aves-block://render/${sandboxId}`,
                };
            },
            release_canvas: request => {

                requireSandbox(request.sandboxId);
                this.#sandboxes.delete(request.sandboxId);
                this.#leases.releaseOwner(owner);

                return undefined;
            },
            snapshots: async request => {

                requireSandbox(request.sandboxId);
                const canvas = await this.document({
                    clientId: "desktop",
                    canvasIds: [canvasId],
                }, canvasId);
                const deliveries = [];
                for (const lease of this.#leases.values()) {
                    if (lease.owner !== owner) {
                        continue;
                    }
                    const block = canvas.blocks.find(candidate => {

                        return candidate.id === lease.blockId
                            && candidate.generation === lease.generation && candidate.revision === lease.revision;
                    });
                    if (!block) {
                        continue;
                    }
                    const snapshot = this.#snapshots.read(canvas, block);
                    lease.dynamic = this.#snapshots.dynamic(block, snapshot);
                    const fingerprint = this.#snapshots.fingerprint(snapshot);
                    if (fingerprint !== lease.fingerprint) {
                        lease.fingerprint = fingerprint;
                        deliveries.push({
                            leaseId: lease.id,
                            snapshot,
                        });
                    }
                }

                return deliveries;
            },
            mount: async request => {

                if (request.canvasId !== canvasId) {
                    throw new OperationError(IpcErrorCode.PermissionDenied, "A canvas cannot mount another canvas's blocks.");
                }
                const canvas = await this.document({
                    clientId: "desktop",
                    canvasIds: [canvasId],
                }, canvasId);
                const block = canvas.blocks.find(candidate => {

                    return candidate.id === request.blockId && candidate.generation === request.generation && candidate.revision === request.revision;
                });
                if (!block || [...this.#leases.values()].filter(lease => {

                    return lease.owner === owner;
                }).length >= 128) {
                    throw new OperationError(IpcErrorCode.Busy, "Block is unavailable or the mount limit was reached.");
                }
                const id = randomUUID();
                this.#leases.register({
                    id,
                    owner,
                    canvasId,
                    blockId: block.id,
                    revision: block.revision,
                    generation: block.generation,
                    dynamic: this.#snapshots.dynamic(block, this.#snapshots.read(canvas, block)),
                    fingerprint: this.#snapshots.fingerprint(this.#snapshots.read(canvas, block)),
                    status: "loading",
                    errors: [],
                });

                return {
                    leaseId: id,
                    revision: block.revision,
                    snapshot: this.#snapshots.read(canvas, block),
                };
            },
            release: request => {

                const lease = requireLease(request.leaseId);
                this.#leases.release(lease.id);

                return undefined;
            },
            report: request => {

                const lease = requireLease(request.leaseId);
                lease.status = request.status;
                if (request.rect) {
                    lease.rect = request.rect;
                }
                if (request.error && !lease.errors.includes(request.error)) {
                    lease.errors.push(request.error);
                }

                return undefined;
            },
            snapshot: async request => {

                const lease = requireLease(request.leaseId);
                const { canvas, block } = await currentBlock(lease);
                if (block.revision !== lease.revision) {
                    throw new OperationError(IpcErrorCode.VersionConflict, "Block source has changed.");
                }

                return this.#snapshots.read(canvas, block);
            },
            state: async request => {

                const lease = requireLease(request.leaseId);
                const { block } = await activeBlock(lease);
                await this.#executor.write(canvasId, block.id, current => {

                    if (current.generation !== lease.generation || current.revision !== lease.revision || current.stateRevision !== request.expectedStateRevision) {
                        throw new OperationError(IpcErrorCode.VersionConflict, "Block state changed.");
                    }

                    return {
                        ...current,
                        viewState: request.state,
                        stateRevision: current.stateRevision + 1,
                    };
                });

                return undefined;
            },
            action: async request => {

                const lease = requireLease(request.leaseId);
                const { canvas, block } = await activeBlock(lease);
                const fingerprint = JSON.stringify(request);
                const previous = this.#leases.getRequest(lease.id, request.requestId);
                if (previous) {
                    if (previous.fingerprint !== fingerprint) {
                        throw new OperationError(IpcErrorCode.InvalidArgument, "Action request ID was reused with different arguments.");
                    }

                    return previous.operation;
                }
                if (this.#leases.requestCount >= 4096) {
                    throw new OperationError(IpcErrorCode.Busy, "Action request limit reached; reopen this canvas.");
                }
                if (this.#inflight.has(`${canvasId}/${block.id}/${block.generation}`) || this.#snapshots.read(canvas, block).actions.some(record => {

                    return record.status === "running";
                })) {
                    throw new OperationError(IpcErrorCode.Busy, "Wait for this block action to complete.");
                }
                this.#inflight.add(`${canvasId}/${block.id}/${block.generation}`);
                const operation = this.#executor.execute(lease, block, request).catch((cause: unknown): BlockActionExecution => {

                    return {
                        result: {
                            error: operationFailure(cause),
                            executionId: request.requestId,
                            actionId: request.actionId,
                            status: "error",
                            result: { message: "Action failed or was declined. Inspect current data before retrying." },
                        },
                    };
                })
                    .then(execution => {

                        const output = execution.result;
                        this.#inflight.delete(`${canvasId}/${block.id}/${block.generation}`);
                        const records = this.#executions.get(`${canvasId}/${block.id}/${block.generation}`) ?? [];
                        this.#executions.set(`${canvasId}/${block.id}/${block.generation}`, [
                            ...records.filter(record => {

                                return record.result.executionId !== output.executionId;
                            }),
                            execution,
                        ].slice(-8));
                        lease.dynamic = !!execution.task || lease.dynamic;
                        this.#leases.notify(canvasId);

                        return output;
                    });
                this.#leases.registerRequest(lease.id, request.requestId, {
                    fingerprint,
                    operation,
                });

                return operation;
            },
        };

        return dispatchCommand<BlockRuntimeRequest, BlockResults>(request, handlers);
    }
    status(canvasId: string, block: DashboardBlock): BlockRuntimeStatus {

        return this.#inspector.status(canvasId, block);
    }
    inspect(access: CanvasAccess, input: unknown) {

        return this.#inspector.inspect(access, input);
    }
    allowedURL(owner: WebContents, address: string): boolean {

        return this.#sandboxes.allowedURL(owner, address);
    }
    dispose(): void {

        clearInterval(this.#clock);
        this.#unsubscribe();
        this.#leases.dispose();
        this.#sandboxes.dispose();
        this.#executions.clear();
    }
}

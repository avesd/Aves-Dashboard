import type { BlockActionResult, BlockInspection, BlockRuntimeResponse, BlockRuntimeStatus, BlockSnapshot } from "../../shared/canvas/blocks";
import { blockRuntimeRequestSchema, capabilitiesSchema, dashboardBlocksChannels, inspectBlocksSchema } from "../../shared/canvas/blocks";
import type { CanvasDocument } from "../../shared/canvas/contracts";
import type { AnswerContinuationStatus } from "../agent/agent-sessions";
import type { WorkspaceFile } from "../storage/workspace-file";
import { CANVAS_DOCUMENT_CSP, canvasDocument } from "./canvas-document";
import type { CanvasAccess, CanvasService } from "./canvas-service";
import type { BlockData, BlockQuestionOwner, DashboardBlock } from "@avesd/workspace-model";
import { blockDataSchema, questionAnswers, readDashboardBlocks, writeDashboardBlocks } from "@avesd/workspace-model";
import type { Rectangle, WebContents } from "electron";
import { protocol } from "electron";
import { randomUUID } from "node:crypto";

interface Lease {
    readonly id: string;
    readonly owner: WebContents;
    readonly canvasId: string;
    readonly blockId: string;
    readonly revision: number;
    readonly generation: string;
    fingerprint?: string;
    dynamic: boolean;
    status: "loading" | "ready" | "error";
    rect?: Rectangle;
    errors: string[];
}
export interface DashboardBlockActions {
    questionOwner(clientId: string): BlockQuestionOwner | undefined;
    questionActive(owner: BlockQuestionOwner, pending: boolean): boolean;
    waitForAnswer(owner: BlockQuestionOwner, key: string, waiting: boolean): void;
    respond(owner: BlockQuestionOwner, id: string, text: string, active: () => Promise<boolean>): AnswerContinuationStatus;
    responseStatus(owner: BlockQuestionOwner, id: string): AnswerContinuationStatus;
    open(canvasId: string): Promise<{
        viewId: number;
        canvasId?: string;
    }>;
    task(canvasId: string, prompt: string, input: BlockData, active: () => Promise<boolean>): Promise<{
        id: string;
    }>;
    taskResult(id: string): {
        status: string;
        answer: string;
    } | undefined;
}

/** One unprivileged document per canvas; host leases still authorize each block separately. */
export class DashboardBlockRuntime {
    readonly #leases = new Map<string, Lease>();
    readonly #sandboxes = new Map<string, {
        owner: WebContents;
        canvasId: string;
    }>();
    readonly #executions = new Map<string, BlockActionResult[]>();
    readonly #requests = new Map<string, {
        fingerprint: string;
        operation: Promise<BlockActionResult>;
    }>();
    readonly #inflight = new Set<string>();
    readonly #owners = new Set<WebContents>();
    readonly #clock: ReturnType<typeof setInterval>;
    readonly #unsubscribe: () => void;
    constructor(private readonly service: CanvasService, private readonly file: WorkspaceFile, private readonly actions: DashboardBlockActions) {

        protocol.handle("aves-block", request => {

            const id = new URL(request.url).pathname.slice(1);
            const lease = this.#sandboxes.get(id);
            if (!lease || lease.owner.isDestroyed()) {
                return new Response("Block is unavailable.", { status: 404 });
            }

            return new Response(canvasDocument(), {
                headers: {
                    "content-type": "text/html; charset=utf-8",
                    "content-security-policy": CANVAS_DOCUMENT_CSP,
                    "cache-control": "no-store",
                },
            });
        });
        this.#unsubscribe = service.subscribe(change => {

            this.#notify(change.canvasId);
        });
        this.#clock = setInterval(() => {

            this.#notify(undefined, true);
        }, 1000);
        this.#clock.unref();
    }
    #notify(canvasId?: string, dynamicOnly = false): void {

        for (const owner of new Set([...this.#leases.values()].filter(lease => {

            return (!canvasId || lease.canvasId === canvasId) && (!dynamicOnly || lease.dynamic);
        }).map(lease => {

            return lease.owner;
        }))) {
            if (!owner.isDestroyed()) {
                owner.send(dashboardBlocksChannels.changed);
            }
        }
    }
    async document(access: CanvasAccess, canvasId: string): Promise<CanvasDocument> {

        const result = await this.service.execute(access, {
            type: "read",
            canvasId,
        });
        if (!result.ok || !result.value || !("blocks" in result.value)) {
            throw new Error("Canvas is unavailable to this caller.");
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
                description: "Save answers to this block's question and continue its original live ACP conversation. Returns acceptance immediately; question snapshots report progress.",
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
                    throw new Error("A data binding references an unavailable source or field.");
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
                    throw new Error("Action input cannot replace its registered target or task.");
                }
                if (action.capability === "canvas.open") {
                    if (typeof params.canvasId !== "string") {
                        throw new Error("Canvas actions require a declared canvas ID.");
                    }
                    await this.document(access, params.canvasId);
                } else if (action.capability === "agent.respond") {
                    if (!block.question || params.questionId !== block.question.id
                        || Object.keys(params).length !== 1 || JSON.stringify(action.inputFields) !== JSON.stringify(["answers"])) {
                        throw new Error("Response actions require this block's questionId and inputFields [answers].");
                    }
                } else if (action.capability === "agent.task") {
                    if (typeof params.prompt !== "string" || !params.prompt.trim() || params.prompt.length > 16_000) {
                        throw new Error("Agent actions require a bounded task description.");
                    }
                } else {
                    if (params.blockId !== undefined && params.blockId !== block.id) {
                        throw new Error("Data actions update their own block.");
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
                        throw new Error("Numeric actions require existing numeric fields.");
                    }
                }
            }
            if (block.question && !block.actions.some(action => {

                return action.capability === "agent.respond";
            })) {
                throw new Error("A question requires a response action.");
            }
        }
    }
    async invoke(owner: WebContents, canvasId: string, input: unknown): Promise<BlockRuntimeResponse> {

        const request = blockRuntimeRequestSchema.parse(input);
        if (request.type === "mount_canvas") {
            await this.document({
                clientId: "desktop",
                canvasIds: [canvasId],
            }, canvasId);
            if ([...this.#sandboxes.values()].some(sandbox => {

                return sandbox.owner === owner;
            })) {
                throw new Error("This canvas already has a sandbox.");
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
        }
        if (request.type === "release_canvas" || request.type === "snapshots") {
            const sandbox = this.#sandboxes.get(request.sandboxId);
            if (!sandbox || sandbox.owner !== owner || sandbox.canvasId !== canvasId) {
                throw new Error("Canvas sandbox has ended.");
            }
            if (request.type === "release_canvas") {
                this.#sandboxes.delete(request.sandboxId);
                for (const lease of this.#leases.values()) {
                    if (lease.owner === owner) {
                        this.#release(lease.id);
                    }
                }

                return;
            }
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
                const snapshot = this.#snapshot(canvas, block);
                lease.dynamic = this.#dynamic(block, snapshot);
                const fingerprint = this.#fingerprint(snapshot);
                if (fingerprint !== lease.fingerprint) {
                    lease.fingerprint = fingerprint;
                    deliveries.push({
                        leaseId: lease.id,
                        snapshot,
                    });
                }
            }

            return deliveries;
        }
        if (request.type === "mount") {
            if (request.canvasId !== canvasId) {
                throw new Error("A canvas cannot mount another canvas's blocks.");
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
                throw new Error("Block is unavailable or the mount limit was reached.");
            }
            const id = randomUUID();
            this.#leases.set(id, {
                id,
                owner,
                canvasId,
                blockId: block.id,
                revision: block.revision,
                generation: block.generation,
                dynamic: this.#dynamic(block, this.#snapshot(canvas, block)),
                fingerprint: this.#fingerprint(this.#snapshot(canvas, block)),
                status: "loading",
                errors: [],
            });
            if (!this.#owners.has(owner)) {
                this.#owners.add(owner);
                owner.once("destroyed", () => {

                    this.#owners.delete(owner);
                    for (const [
                        leaseId,
                        entry,
                    ] of this.#leases) {
                        if (entry.owner === owner) {
                            this.#leases.delete(leaseId);
                            for (const key of this.#requests.keys()) {
                                if (key.startsWith(`${leaseId}/`)) {
                                    this.#requests.delete(key);
                                }
                            }
                        }
                    }
                });
            }

            return {
                leaseId: id,
                revision: block.revision,
                snapshot: this.#snapshot(canvas, block),
            };
        }
        const lease = this.#leases.get(request.leaseId);
        if (!lease || lease.owner !== owner || lease.canvasId !== canvasId) {
            throw new Error("Block lease has ended.");
        }
        if (request.type === "release") {
            this.#release(lease.id);

            return;
        }
        if (request.type === "report") {
            lease.status = request.status;
            if (request.rect) {
                lease.rect = request.rect;
            }
            if (request.error && !lease.errors.includes(request.error)) {
                lease.errors.push(request.error);
            }

            return;
        }
        const canvas = await this.document({
            clientId: "desktop",
            canvasIds: [canvasId],
        }, canvasId);
        const block = canvas.blocks.find(candidate => {

            return candidate.id === lease.blockId;
        });
        if (!block || block.generation !== lease.generation) {
            throw new Error("Block was removed.");
        }
        if (request.type === "snapshot") {
            if (block.revision !== lease.revision) {
                throw new Error("Block source has changed.");
            }

            return this.#snapshot(canvas, block);
        }
        if (block.revision !== lease.revision || lease.status !== "ready") {
            throw new Error("This block version is no longer active.");
        }
        if (request.type === "state") {
            await this.#write(canvasId, block.id, current => {

                if (current.generation !== lease.generation || current.revision !== lease.revision || current.stateRevision !== request.expectedStateRevision) {
                    throw new Error("Block state changed.");
                }

                return {
                    ...current,
                    viewState: request.state,
                    stateRevision: current.stateRevision + 1,
                };
            });

            return;
        }
        const key = `${lease.id}/${request.requestId}`;
        const fingerprint = JSON.stringify(request);
        const previous = this.#requests.get(key);
        if (previous) {
            if (previous.fingerprint !== fingerprint) {
                throw new Error("Action request ID was reused with different arguments.");
            }

            return previous.operation;
        }
        if (this.#requests.size >= 4096) {
            throw new Error("Action request limit reached; reopen this canvas.");
        }
        if (this.#inflight.has(`${canvasId}/${block.id}/${block.generation}`) || this.#snapshot(canvas, block).actions.some(record => {

            return record.status === "running";
        })) {
            throw new Error("Wait for this block action to complete.");
        }
        this.#inflight.add(`${canvasId}/${block.id}/${block.generation}`);
        const operation = this.#action(lease, block, request).catch((): BlockActionResult => {

            return {
                executionId: request.requestId,
                actionId: request.actionId,
                status: "error",
                result: { message: "Action failed or was declined. Inspect current data before retrying." },
            };
        });
        this.#requests.set(key, {
            fingerprint,
            operation,
        });
        const output = await operation;
        this.#inflight.delete(`${canvasId}/${block.id}/${block.generation}`);
        const records = this.#executions.get(`${canvasId}/${block.id}/${block.generation}`) ?? [];
        this.#executions.set(`${canvasId}/${block.id}/${block.generation}`, [
            ...records.filter(record => {

                return record.executionId !== output.executionId;
            }),
            output,
        ].slice(-8));
        lease.dynamic = !!output.taskId || lease.dynamic;
        this.#notify(canvasId);

        return output;
    }
    #release(id: string): void {

        this.#leases.delete(id);
        for (const key of this.#requests.keys()) {
            if (key.startsWith(`${id}/`)) {
                this.#requests.delete(key);
            }
        }
    }
    #dynamic(block: DashboardBlock, snapshot: BlockSnapshot): boolean {

        return block.bindings.some(binding => {

            return binding.sourceId === "clock";
        })
            || snapshot.question?.status === "pending"
            || snapshot.question?.continuation === "queued" || snapshot.question?.continuation === "running"
            || snapshot.actions.some(action => {

                return action.status === "running";
            });
    }
    #fingerprint({ sampledAt: _sampledAt, ...snapshot }: BlockSnapshot): string {

        return JSON.stringify(snapshot);
    }
    #snapshot(canvas: CanvasDocument, block: DashboardBlock): BlockSnapshot {

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
        const actions = (this.#executions.get(`${canvas.id}/${block.id}/${block.generation}`) ?? []).map(record => {

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
                status: [
                    "completed",
                    "error",
                    "stopped",
                ].includes(task.status) ? task.status === "completed" ? "completed" as const : "error" as const : "running" as const,
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

        return {
            id: question.id,
            title: question.title,
            fields: question.fields,
            revision: question.revision,
            status: submission ? "answered" : available ? "pending" : "unavailable",
            canRetry: available && continuation === "error",
            ...(submission ? {
                answers: submission.answers,
                submissionId: submission.id,
                continuation,
            } : {}),
        };
    }
    async #action(lease: Lease, block: DashboardBlock, request: Extract<ReturnType<typeof blockRuntimeRequestSchema.parse>, {
        type: "action";
    }>): Promise<BlockActionResult> {

        const action = block.actions.find(candidate => {

            return candidate.id === request.actionId;
        });
        if (!action || Object.keys(request.input).some(key => {

            return !action.inputFields.includes(key);
        })) {
            throw new Error("Action or input was not registered.");
        }
        let result: BlockData;
        let taskId: string | undefined;
        if (action.capability === "block.set_data") {
            const target = action.parameters.blockId ?? block.id;
            if (typeof target !== "string") {
                throw new Error("Invalid block target.");
            }
            const patch = blockDataSchema.parse(action.parameters.patch ?? {});
            const increment = blockDataSchema.parse(action.parameters.increment ?? {});
            await this.#write(lease.canvasId, target, current => {

                if (target !== block.id || current.generation !== lease.generation || current.revision !== lease.revision || current.dataRevision !== request.expectedDataRevision || !current.actions.some(registered => {

                    return JSON.stringify(registered) === JSON.stringify(action);
                })) {
                    throw new Error("Data action must update its own current block revision.");
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
                        throw new Error("Numeric increments require numeric fields.");
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
                throw new Error("Invalid canvas target.");
            }
            result = { ...await this.actions.open(action.parameters.canvasId) };
        } else if (action.capability === "agent.respond") {
            let question = block.question;
            if (!question || action.parameters.questionId !== question.id || request.expectedQuestionRevision !== question.revision) {
                throw new Error("Question has changed; inspect it before responding.");
            }
            const answers = questionAnswers(question, request.input.answers);
            await this.#write(lease.canvasId, block.id, current => {

                const active = current.question;
                if (current.generation !== lease.generation || current.revision !== lease.revision
                    || active?.generation !== question!.generation || !current.actions.some(registered => {

                    return JSON.stringify(registered) === JSON.stringify(action);
                })) {
                    throw new Error("Question document has changed.");
                }
                if (active.submission) {
                    if (JSON.stringify(active.submission.answers) !== JSON.stringify(answers)) {
                        throw new Error("Question was already answered differently.");
                    }
                } else {
                    if (!this.actions.questionActive(active.owner, true)) {
                        throw new Error("The original question session has ended.");
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
                throw new Error("Invalid task description.");
            }
            const task = await this.actions.task(lease.canvasId, action.parameters.prompt, request.input, async () => {

                if (!this.#leases.has(lease.id) || lease.owner.isDestroyed()) {
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
            taskId = task.id;
            result = { taskId: task.id };
        }

        return {
            executionId: request.requestId,
            actionId: action.id,
            status: taskId ? "running" : "completed",
            result,
            ...(taskId ? { taskId } : {}),
        };
    }
    async #write(canvasId: string, blockId: string, update: (current: DashboardBlock) => DashboardBlock): Promise<void> {

        await this.file.transaction((snapshot, metadata) => {

            const dashboard = snapshot?.dashboards.find(candidate => {

                return candidate.id === canvasId;
            });
            if (!snapshot || !dashboard) {
                throw new Error("Canvas is unavailable.");
            }
            const currentBlocks = readDashboardBlocks(dashboard);
            if (!currentBlocks.some(block => {

                return block.id === blockId;
            })) {
                throw new Error("Block is unavailable.");
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
    status(canvasId: string, block: DashboardBlock): BlockRuntimeStatus {

        const leases = [...this.#leases.values()].filter(lease => {

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
                throw new Error("Block is unavailable.");
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
                ...(request.include.includes("data") ? { snapshot: this.#snapshot(canvas, block) } : {}),
                ...(request.include.includes("actions") ? { actions: block.actions } : {}),
            };
        });
        if (request.include.includes("screenshot")) {
            for (const block of selected.slice(0, 4)) {
                const lease = [...this.#leases.values()].find(candidate => {

                    return candidate.canvasId === canvas.id && candidate.blockId === block.id && candidate.generation === block.generation && candidate.revision === block.revision && candidate.status === "ready" && !candidate.owner.isDestroyed();
                });
                const rect = lease?.rect;
                if (lease && rect && rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.y >= 0) {
                    const image = await lease.owner.capturePage(rect);
                    const latest = await this.document(access, canvas.id);
                    if (!latest.blocks.some(candidate => {

                        return candidate.id === block.id && candidate.revision === block.revision && candidate.dataRevision === block.dataRevision;
                    })) {
                        throw new Error("Block changed during capture; inspect again.");
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
    allowedURL(owner: WebContents, address: string): boolean {

        try {
            const url = new URL(address);
            const lease = this.#sandboxes.get(url.pathname.slice(1));

            return url.protocol === "aves-block:" && url.hostname === "render" && !!lease && lease.owner === owner;
        } catch {
            return false;
        }
    }
    dispose(): void {

        clearInterval(this.#clock); this.#unsubscribe(); this.#leases.clear(); this.#sandboxes.clear(); this.#executions.clear(); this.#requests.clear(); protocol.unhandle("aves-block");
    }
}

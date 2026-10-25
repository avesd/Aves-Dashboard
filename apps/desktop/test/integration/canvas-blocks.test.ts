/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Integration
 * @description Canvas Blocks.test
 */

import { AgentPreferences } from "../../src/main/agent/agent-preferences";
import { DeepSeekAgentHost } from "../../src/main/agent/deepseek-agent-host";
import { AgentSessions } from "../../src/main/agent/sessions/agent-sessions";
import { BlockActionExecutor } from "../../src/main/canvas/blocks/block-actions";
import { BlockInspector } from "../../src/main/canvas/blocks/block-inspection";
import { BlockLeases } from "../../src/main/canvas/blocks/block-leases";
import type { BlockLease, DashboardBlockActions } from "../../src/main/canvas/blocks/block-runtime-types";
import { BlockSnapshots } from "../../src/main/canvas/blocks/block-snapshots";
import { CanvasService } from "../../src/main/canvas/canvas-service";
import { captureIpcResult } from "../../src/main/ipc/ipc-result";
import { WorkspaceFile } from "../../src/main/storage/workspace-file";
import type { BlockActionResult, BlockRuntimeRequest } from "@avesd/desktop-contracts/canvas/blocks";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import type { DashboardScope } from "@avesd/workspace-model";
import { dashboardBlockSchema, parseWorkspaceSnapshot, readDashboardBlocks, writeDashboardBlocks } from "@avesd/workspace-model";
import type { WebContents } from "electron";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";

async function createRuntime(service: CanvasService, file: WorkspaceFile, actions: DashboardBlockActions) {

    const hooks = registerHooks({
        resolve(specifier, context, nextResolve) {

            if (specifier === "electron") {
                return {
                    url: "data:text/javascript,export const protocol = { handle() {}, unhandle() {} };",
                    shortCircuit: true,
                };
            }

            return nextResolve(specifier, context);
        },
    });
    try {
        const { DashboardBlockRuntime } = await import("../../src/main/canvas/blocks/block-runtime");

        return new DashboardBlockRuntime(service, file, actions);
    } finally {
        hooks.deregister();
    }
}

async function setup(t: TestContext, capability: "block.set_data" | "agent.task") {

    const directory = await mkdtemp(join(tmpdir(), "avesd-block-boundary-"));
    t.after(async () => {

        await rm(directory, {
            recursive: true,
            force: true,
        });
    });
    const file = new WorkspaceFile(join(directory, "workspace.json"));
    const block = dashboardBlockSchema.parse({
        id: "synthetic-block",
        generation: randomUUID(),
        description: "Synthetic block",
        source: { html: "<p>Synthetic block</p>" },
        bounds: {
            x: 0,
            y: 0,
            width: 200,
            height: 100,
        },
        revision: 1,
        data: { count: 0 },
        dataRevision: 1,
        viewState: {},
        stateRevision: 1,
        bindings: [],
        actions: [
            {
                id: "run",
                label: "Run",
                capability,
                parameters: capability === "block.set_data" ? { increment: { count: 1 } } : { prompt: "Synthetic task" },
            },
        ],
    });
    const snapshot = parseWorkspaceSnapshot({
        version: 1,
        workspaces: [
            {
                id: "synthetic-workspace",
                name: "Synthetic workspace",
            },
        ],
        dashboards: [
            {
                id: "synthetic-canvas",
                workspaceId: "synthetic-workspace",
                name: "Synthetic canvas",
                layoutRevision: 0,
                viewState: {},
            },
        ],
        widgets: [],
        dataSources: [],
    });
    assert.ok(snapshot);
    const dashboard = snapshot.dashboards[0]!;
    await file.save({
        ...snapshot,
        dashboards: [
            {
                ...dashboard,
                viewState: writeDashboardBlocks(dashboard, [block]),
            },
        ],
    });
    const service = new CanvasService(file);
    const document = async () => {

        const result = await service.execute({
            clientId: "synthetic",
            canvasIds: [dashboard.id],
        }, {
            type: "read",
            canvasId: dashboard.id,
        });
        assert.equal(result.ok, true);
        assert.ok(result.value && "blocks" in result.value);

        return result.value;
    };
    const events = new EventEmitter();
    // Only the native owner methods exercised by these boundary tests are substituted.
    const owner = Object.assign(events, {
        isDestroyed: () => {

            return false;
        },
        send() {},
    }) as unknown as WebContents;
    const lease: BlockLease = {
        id: randomUUID(),
        owner,
        canvasId: dashboard.id,
        blockId: block.id,
        generation: block.generation,
        revision: block.revision,
        dynamic: false,
        status: "ready",
        errors: [],
    };
    const actions: DashboardBlockActions = {
        questionOwner() {},
        questionActive() {

            return false;
        },
        waitForAnswer() {},
        respond() {

            return "unavailable";
        },
        responseStatus() {

            return "unavailable";
        },
        async open() {

            return { viewId: 1 };
        },
        async task() {

            return {
                id: "synthetic-task",
                snapshot: () => {

                    return {
                        status: "completed",
                        answer: "Synthetic answer",
                    };
                },
            };
        },
    };
    let active = true;
    const executor = new BlockActionExecutor(service, file, actions, document, () => {

        return active;
    });
    const request: Extract<BlockRuntimeRequest, {
        type: "action";
    }> = {
        type: "action",
        leaseId: lease.id,
        requestId: randomUUID(),
        actionId: "run",
        input: {},
        expectedDataRevision: 1,
    };

    return {
        file,
        service,
        block,
        lease,
        actions,
        executor,
        request,
        document,
        events,
        revoke: () => {

            active = false;
        },
    };
}

void test("block writes reject stale data and recover without losing persisted state", async t => {

    const { file, block, lease, executor, request } = await setup(t, "block.set_data");

    await assert.rejects(executor.execute(lease, block, {
        ...request,
        expectedDataRevision: 0,
    }), { code: IpcErrorCode.VersionConflict });
    const unchanged = await file.load();
    assert.ok(unchanged);
    assert.equal(readDashboardBlocks(unchanged.dashboards[0]!)[0]!.data.count, 0);

    await executor.execute(lease, block, request);
    const stored = await file.load();
    assert.ok(stored);
    const updated = readDashboardBlocks(stored.dashboards[0]!)[0]!;
    assert.equal(updated.data.count, 1);
    assert.equal(updated.dataRevision, 2);
});

void test("question answer validation preserves invalid-argument failures before persistence", async t => {

    const { block, lease, executor, request, actions, document } = await setup(t, "block.set_data");
    const questionBlock = dashboardBlockSchema.parse({
        ...block,
        question: {
            id: "synthetic-question",
            generation: randomUUID(),
            revision: 1,
            owner: {
                sessionId: randomUUID(),
                connectionId: randomUUID(),
                turnId: randomUUID(),
            },
            title: "Synthetic question",
            fields: [
                {
                    key: "note",
                    label: "Synthetic note",
                    type: "text",
                },
                {
                    key: "choice",
                    label: "Synthetic choice",
                    type: "single_choice",
                    options: [
                        {
                            value: "alpha",
                            label: "Alpha",
                        },
                    ],
                },
                {
                    key: "choices",
                    label: "Synthetic choices",
                    type: "multiple_choice",
                    options: [
                        {
                            value: "alpha",
                            label: "Alpha",
                        },
                        {
                            value: "beta",
                            label: "Beta",
                        },
                    ],
                },
            ],
        },
        actions: [
            {
                id: "respond",
                label: "Respond",
                capability: "agent.respond",
                parameters: { questionId: "synthetic-question" },
                inputFields: ["answers"],
            },
        ],
    });
    await executor.write(lease.canvasId, block.id, () => {

        return questionBlock;
    });
    let continuations = 0;
    actions.questionActive = () => {

        return true;
    };
    actions.respond = () => {

        continuations++;

        return "queued";
    };
    const valid = {
        note: "Synthetic answer",
        choice: "alpha",
        choices: ["alpha"],
    };
    const submission = {
        ...request,
        actionId: "respond",
        expectedQuestionRevision: 1,
    };

    for (const answers of [
        {
            choice: "alpha",
            choices: ["alpha"],
        },
        {
            ...valid,
            unknown: "synthetic-private-answer",
        },
        {
            ...valid,
            note: 42,
        },
        {
            ...valid,
            note: "   ",
        },
        {
            ...valid,
            choice: "synthetic-private-choice",
        },
        {
            ...valid,
            choices: [
                "alpha",
                "alpha",
            ],
        },
    ]) {
        const result = await captureIpcResult(() => {

            return executor.execute(lease, questionBlock, {
                ...submission,
                requestId: randomUUID(),
                input: { answers },
            });
        });

        assert.deepEqual(result, {
            ok: false,
            error: {
                code: IpcErrorCode.InvalidArgument,
                message: "Invalid request parameters.",
            },
        });
    }

    const rejected = await document();
    assert.equal(rejected.blocks[0]!.question?.submission, undefined);
    assert.equal(continuations, 0);

    const accepted = await executor.execute(lease, questionBlock, {
        ...submission,
        requestId: randomUUID(),
        input: {
            answers: {
                ...valid,
                note: "  Synthetic answer  ",
                choices: [
                    "beta",
                    "alpha",
                ],
            },
        },
    });
    const saved = await document();

    assert.equal(accepted.result.status, "completed");
    assert.equal(accepted.result.result?.accepted, true);
    assert.equal(continuations, 1);
    assert.deepEqual(saved.blocks[0]!.question?.submission?.answers, {
        ...valid,
        choices: [
            "alpha",
            "beta",
        ],
    });
});

void test("deferred task admission rechecks both the lease and current block registration", async t => {

    const { block, lease, actions, executor, request, revoke } = await setup(t, "agent.task");
    let admission: () => Promise<boolean> = async () => {

        return false;
    };
    actions.task = async (_canvasId, _prompt, _input, active) => {

        admission = active;

        return {
            id: "synthetic-task",
            snapshot: () => {

                return {
                    status: "completed",
                    answer: "Synthetic answer",
                };
            },
        };
    };

    await executor.execute(lease, block, request);
    assert.equal(await admission(), true);

    await executor.write(lease.canvasId, block.id, current => {

        return {
            ...current,
            revision: current.revision + 1,
        };
    });
    assert.equal(await admission(), false);

    await executor.write(lease.canvasId, block.id, current => {

        return {
            ...current,
            revision: block.revision,
        };
    });
    revoke();
    assert.equal(await admission(), false);
});

void test("cancelled Agent tasks release block admission and survive conversation reuse", async t => {

    const { file, service, block, lease, actions, request } = await setup(t, "agent.task");
    let entered!: () => void;
    const started = new Promise<void>(resolve => {

        entered = resolve;
    });
    let providerRequests = 0;
    const sessions: AgentSessions = new AgentSessions(new AgentPreferences(), async () => {

        throw new Error("No implicit task origin expected.");
    }, async (_origin, _route, id) => {

        return {
            host: new DeepSeekAgentHost({
                key: () => {

                    return "synthetic-key";
                },
                authorize: executionId => {

                    return sessions.authorizeExecution(id, executionId);
                },
                request: async (_url, init) => {

                    providerRequests++;
                    if (providerRequests === 1) {
                        return new Promise<Response>((_resolve, reject) => {

                            init!.signal!.addEventListener("abort", () => {

                                reject(new Error("Synthetic cancellation."));
                            }, { once: true });
                            entered();
                        });
                    }

                    return Response.json({
                        choices: [
                            {
                                finish_reason: "stop",
                                message: { content: "Later conversation answer" },
                            },
                        ],
                    });
                },
                invoke: async () => {

                    throw new Error("No tools expected.");
                },
            }),
            release() {},
        };
    }, () => {
    });
    const { id } = await sessions.create("reasoning", {
        workspaceId: "synthetic-workspace" as DashboardScope["workspaceId"],
        dashboardId: lease.canvasId as DashboardScope["dashboardId"],
        kind: "interactive",
        source: "Synthetic block task",
    });
    let launches = 0;
    actions.task = async (_canvasId, prompt, _input, active) => {

        assert.equal(await active(), true);
        launches++;

        return sessions.startTask(prompt, id);
    };
    const runtime = await createRuntime(service, file, actions);
    try {
        const mounted = await runtime.invoke(lease.owner, lease.canvasId, {
            type: "mount",
            canvasId: lease.canvasId,
            blockId: block.id,
            generation: block.generation,
            revision: block.revision,
        });
        assert.ok("leaseId" in mounted);
        const leaseId = mounted.leaseId;
        await runtime.invoke(lease.owner, lease.canvasId, {
            type: "report",
            leaseId,
            status: "ready",
        });
        const snapshot = async () => {

            const result = await runtime.invoke(lease.owner, lease.canvasId, {
                type: "snapshot",
                leaseId,
            });
            assert.ok("actions" in result);

            return result;
        };

        await runtime.invoke(lease.owner, lease.canvasId, {
            ...request,
            leaseId,
        });
        await started;

        assert.equal((await snapshot()).actions[0]!.status, "running");
        await assert.rejects(runtime.invoke(lease.owner, lease.canvasId, {
            ...request,
            leaseId,
            requestId: randomUUID(),
        }), { code: IpcErrorCode.Busy });

        await sessions.cancelTurn(id);

        const cancelled = (await snapshot()).actions[0]!;
        assert.equal(sessions.read(id).status, "idle");
        assert.equal(cancelled.status, "error");
        assert.equal(cancelled.result?.status, "cancelled");

        await sessions.prompt("A later user turn", id);
        await runtime.invoke(lease.owner, lease.canvasId, {
            ...request,
            leaseId,
            requestId: randomUUID(),
        });
        await setImmediate();
        await sessions.remove(id);

        const settled = (await snapshot()).actions;
        assert.equal(launches, 2);
        assert.deepEqual(settled[0], cancelled);
        assert.equal(settled[1]!.status, "completed");
        assert.equal(settled[1]!.result?.answer, "Later conversation answer");
    } finally {
        sessions.dispose();
        runtime.dispose();
    }
});

void test("block document reads preserve safe failures and distinguish invalid success shapes", async t => {

    const { file, service, lease, actions } = await setup(t, "block.set_data");
    const runtime = await createRuntime(service, file, actions);
    const access = {
        clientId: "synthetic",
        canvasIds: [lease.canvasId],
    };
    try {
        const readable = await runtime.document(access, lease.canvasId);

        assert.equal(readable.id, lease.canvasId);

        const missing = await captureIpcResult(() => {

            return runtime.document(access, "synthetic-missing");
        });
        const concealed = await captureIpcResult(() => {

            return runtime.document({
                ...access,
                canvasIds: [],
            }, lease.canvasId);
        });
        const revoked = await captureIpcResult(() => {

            return runtime.document({
                ...access,
                isActive: () => {

                    return false;
                },
            }, lease.canvasId);
        });

        assert.ok(!missing.ok);
        assert.equal(missing.error.code, IpcErrorCode.NotFound);
        assert.deepEqual(concealed, missing);
        assert.ok(!revoked.ok);
        assert.equal(revoked.error.code, IpcErrorCode.PermissionDenied);

        file.readService = async () => {

            throw new Error("synthetic-private-storage-detail");
        };
        const unavailable = await captureIpcResult(() => {

            return runtime.document(access, lease.canvasId);
        });

        assert.ok(!unavailable.ok);
        assert.equal(unavailable.error.code, IpcErrorCode.ServiceNotReady);
        assert.equal(JSON.stringify(unavailable).includes("synthetic-private-storage-detail"), false);

        service.execute = async () => {

            return {
                ok: true,
                value: null,
            };
        };
        const invalid = await captureIpcResult(() => {

            return runtime.document(access, lease.canvasId);
        });

        assert.ok(!invalid.ok);
        assert.equal(invalid.error.code, IpcErrorCode.Internal);
    } finally {
        runtime.dispose();
    }
});

void test("runtime dispatch preserves state revisions and ownership across lease and sandbox release", async t => {

    const { service, file, actions, lease, block } = await setup(t, "block.set_data");
    const runtime = await createRuntime(service, file, actions);
    try {
        const sandbox = await runtime.invoke(lease.owner, lease.canvasId, { type: "mount_canvas" });
        const mountRequest = {
            type: "mount",
            canvasId: lease.canvasId,
            blockId: block.id,
            generation: block.generation,
            revision: block.revision,
        } as const;
        const mounted = await runtime.invoke(lease.owner, lease.canvasId, mountRequest);
        const foreign = new EventEmitter() as unknown as WebContents;

        await assert.rejects(runtime.invoke(foreign, lease.canvasId, {
            type: "release",
            leaseId: mounted.leaseId,
        }), { code: IpcErrorCode.PermissionDenied });
        await assert.rejects(runtime.invoke(foreign, lease.canvasId, {
            type: "release_canvas",
            sandboxId: sandbox.sandboxId,
        }), { code: IpcErrorCode.PermissionDenied });

        await runtime.invoke(lease.owner, lease.canvasId, {
            type: "report",
            leaseId: mounted.leaseId,
            status: "ready",
        });
        const stateRequest = {
            type: "state",
            leaseId: mounted.leaseId,
            expectedStateRevision: 1,
            state: { expanded: true },
        } as const;
        await runtime.invoke(lease.owner, lease.canvasId, stateRequest);

        const snapshot = await runtime.invoke(lease.owner, lease.canvasId, {
            type: "snapshot",
            leaseId: mounted.leaseId,
        });
        assert.equal(snapshot.stateRevision, 2);
        assert.deepEqual(snapshot.viewState, { expanded: true });
        await assert.rejects(runtime.invoke(lease.owner, lease.canvasId, stateRequest), { code: IpcErrorCode.VersionConflict });

        const deliveries = await runtime.invoke(lease.owner, lease.canvasId, {
            type: "snapshots",
            sandboxId: sandbox.sandboxId,
        });
        assert.deepEqual(deliveries.map(delivery => {

            return delivery.leaseId;
        }), [mounted.leaseId]);

        await runtime.invoke(lease.owner, lease.canvasId, {
            type: "release",
            leaseId: mounted.leaseId,
        });

        assert.deepEqual(await runtime.invoke(lease.owner, lease.canvasId, {
            type: "snapshots",
            sandboxId: sandbox.sandboxId,
        }), []);

        const replacement = await runtime.invoke(lease.owner, lease.canvasId, mountRequest);
        await runtime.invoke(lease.owner, lease.canvasId, {
            type: "release_canvas",
            sandboxId: sandbox.sandboxId,
        });

        await assert.rejects(runtime.invoke(lease.owner, lease.canvasId, {
            type: "snapshot",
            leaseId: replacement.leaseId,
        }), { code: IpcErrorCode.PermissionDenied });
        // Untyped transport input must still pass the strict runtime schema.
        await assert.rejects(Reflect.apply(runtime.invoke, runtime, [
            lease.owner,
            lease.canvasId,
            {
                type: "mount_canvas",
                extra: true,
            },
        ]), { name: "ZodError" });
    } finally {
        runtime.dispose();
    }
});

void test("lease registration shares cleanup across manual release, owner destruction, and disposal", async t => {

    const { lease, events } = await setup(t, "block.set_data");
    const registry = new BlockLeases();
    const otherEvents = new EventEmitter();
    const other = {
        ...lease,
        id: randomUUID(),
        owner: otherEvents as unknown as WebContents,
    };
    const sibling = {
        ...lease,
        id: randomUUID(),
    };
    const request = {
        fingerprint: "synthetic",
        operation: Promise.resolve<BlockActionResult>({
            executionId: "synthetic",
            actionId: "run",
            status: "completed",
        }),
    };
    registry.register(lease);
    registry.register(sibling);
    registry.register(other);
    registry.registerRequest(lease.id, "synthetic-request", request);
    registry.registerRequest(sibling.id, "synthetic-request", request);
    registry.registerRequest(other.id, "synthetic-request", request);

    assert.equal(events.listenerCount("destroyed"), 1);
    assert.equal(registry.getRequest(lease.id, "synthetic-request")?.operation, request.operation);

    registry.release(sibling.id);

    assert.equal(registry.has(sibling.id), false);
    assert.equal(registry.getRequest(sibling.id, "synthetic-request"), undefined);
    assert.equal(registry.requestCount, 2);

    events.emit("destroyed");

    assert.equal(registry.get(lease.id), undefined);
    assert.equal(registry.getRequest(lease.id, "synthetic-request"), undefined);
    assert.equal(registry.get(other.id), other);
    assert.equal(registry.getRequest(other.id, "synthetic-request")?.operation, request.operation);

    registry.registerRequest(lease.id, "late-request", request);

    assert.equal(registry.getRequest(lease.id, "late-request"), undefined);
    assert.equal(registry.requestCount, 1);

    registry.dispose();

    assert.deepEqual([...registry.values()], []);
    assert.equal(registry.requestCount, 0);
});

void test("inspection rejects a block changed during capture and propagates revoked read access", async t => {

    const { block, lease, actions, executor, document } = await setup(t, "block.set_data");
    const leases = new Map([
        [
            lease.id,
            lease,
        ],
    ]);
    lease.rect = {
        x: 0,
        y: 0,
        width: 200,
        height: 100,
    };
    function throwIfCaptured(): never {

        // A synthetic image is unnecessary: the revalidation occurs before encoding.
        throw new Error("Synthetic capture placeholder");
    }
    let readable = true;
    const inspector = new BlockInspector(leases, new BlockSnapshots(actions, new Map()), async () => {

        if (!readable) {
            throw new OperationError(IpcErrorCode.PermissionDenied, "Synthetic access revoked.");
        }

        return document();
    });
    const access = {
        clientId: "synthetic",
        canvasIds: [lease.canvasId],
    };
    // Return only the image operation that can be reached after successful revalidation.
    lease.owner.capturePage = async () => {

        await executor.write(lease.canvasId, block.id, current => {

            return {
                ...current,
                dataRevision: current.dataRevision + 1,
            };
        });

        return { toPNG: throwIfCaptured } as unknown as Awaited<ReturnType<WebContents["capturePage"]>>;
    };

    await assert.rejects(inspector.inspect(access, {
        canvasId: lease.canvasId,
        include: ["screenshot"],
    }), { code: IpcErrorCode.VersionConflict });

    readable = false;
    await assert.rejects(inspector.inspect(access, { canvasId: lease.canvasId }), { code: IpcErrorCode.PermissionDenied });
});

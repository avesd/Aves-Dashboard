/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Integration
 * @description Canvas Blocks.test
 */

import { BlockActionExecutor } from "../../src/main/canvas/blocks/block-actions";
import { BlockInspector } from "../../src/main/canvas/blocks/block-inspection";
import { BlockLeases } from "../../src/main/canvas/blocks/block-leases";
import type { BlockLease, DashboardBlockActions } from "../../src/main/canvas/blocks/block-runtime-types";
import { BlockSnapshots } from "../../src/main/canvas/blocks/block-snapshots";
import { CanvasService } from "../../src/main/canvas/canvas-service";
import { WorkspaceFile } from "../../src/main/storage/workspace-file";
import type { BlockRuntimeRequest } from "@avesd/desktop-contracts/canvas/blocks";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import { dashboardBlockSchema, parseWorkspaceSnapshot, readDashboardBlocks, writeDashboardBlocks } from "@avesd/workspace-model";
import type { WebContents } from "electron";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { test } from "node:test";

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

            return { id: "synthetic-task" };
        },
        taskResult() {},
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

void test("deferred task admission rechecks both the lease and current block registration", async t => {

    const { block, lease, actions, executor, request, revoke } = await setup(t, "agent.task");
    let admission: () => Promise<boolean> = async () => {

        return false;
    };
    actions.task = async (_canvasId, _prompt, _input, active) => {

        admission = active;

        return { id: "synthetic-task" };
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

void test("owner destruction releases its leases and deduplicated requests only", async t => {

    const { lease, events } = await setup(t, "block.set_data");
    const registry = new BlockLeases();
    const other = {
        ...lease,
        id: randomUUID(),
        owner: {} as WebContents,
    };
    registry.entries.set(lease.id, lease);
    registry.entries.set(other.id, other);
    registry.requests.set(`${lease.id}/synthetic-request`, {
        fingerprint: "synthetic",
        operation: Promise.resolve({
            executionId: "synthetic",
            actionId: "run",
            status: "completed",
        }),
    });
    registry.watch(lease.owner);
    registry.watch(lease.owner);

    events.emit("destroyed");

    assert.equal(registry.entries.has(lease.id), false);
    assert.equal(registry.requests.size, 0);
    assert.equal(registry.entries.has(other.id), true);
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

/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Integration
 * @description Verify independent canvas data revisions and durable mutation receipts
 */

import { CanvasService } from "../../src/main/canvas/canvas-service";
import { WorkspaceFile } from "../../src/main/storage/workspace-file";
import type { CanvasChange, CanvasDocument, CanvasRequest, CanvasResponse } from "@avesd/desktop-contracts/canvas/contracts";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { test } from "node:test";

async function setup(t: TestContext) {

    const directory = await mkdtemp(join(tmpdir(), "avesd-canvas-revisions-"));
    t.after(async () => {

        await rm(directory, {
            recursive: true,
            force: true,
        });
    });
    const path = join(directory, "workspace.json");
    const file = new WorkspaceFile(path);
    await file.save({
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
    const service = new CanvasService(file);
    const access = {
        clientId: "synthetic",
        canvasIds: "all" as const,
    };
    const execute = async (request: CanvasRequest): Promise<CanvasResponse> => {

        const result = await service.execute(access, request);
        assert.ok(result.ok, JSON.stringify(result));

        return result.value;
    };
    const read = async (): Promise<CanvasDocument> => {

        const document = await execute({
            type: "read",
            canvasId: "synthetic-canvas",
        });
        assert.ok(document && "blocks" in document);

        return document;
    };
    await execute({
        type: "render",
        requestId: "initial",
        canvasId: "synthetic-canvas",
        expectedRevision: 0,
        changes: [
            "a",
            "b",
        ].map(id => {

            return {
                type: "create",
                id,
                source: {
                    html: "<p>Synthetic</p>",
                    css: "",
                    js: "",
                },
                bounds: {
                    x: 0,
                    y: 0,
                    width: 200,
                    height: 100,
                },
                description: "",
                data: { count: 0 },
                bindings: [],
                actions: [],
            };
        }),
    });

    return {
        path,
        service,
        access,
        execute,
        read,
    };
}

void test("data-only batches preserve canvas revision, notify readers, and retain durable receipt recovery", async t => {

    const { path, service, access, execute, read } = await setup(t);
    const events: CanvasChange[] = [];
    service.subscribe(event => {

        events.push(event);
    });
    const before = await read();
    const request: CanvasRequest = {
        type: "render",
        requestId: "data-only",
        canvasId: before.id,
        expectedRevision: before.revision,
        changes: [
            "a",
            "b",
        ].map(id => {

            return {
                type: "update",
                id,
                data: { count: 1 },
                expectedDataRevision: 0,
            };
        }),
    };

    const receipt = await execute(request);
    const updated = await read();
    assert.equal(updated.revision, before.revision);
    assert.deepEqual(updated.blocks.map(block => {

        return [
            block.revision,
            block.dataRevision,
            block.data.count,
        ];
    }), [
        [
            1,
            1,
            1,
        ],
        [
            1,
            1,
            1,
        ],
    ]);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.type, "canvas.changed");
    assert.equal(events[0]!.revision, before.revision);

    await execute({
        type: "render",
        requestId: "source-after-data",
        canvasId: before.id,
        expectedRevision: before.revision,
        changes: [
            {
                type: "update",
                id: "a",
                source: {
                    html: "<p>Updated synthetic</p>",
                    css: "",
                    js: "",
                },
            },
        ],
    });
    const edited = await read();
    assert.equal(edited.revision, before.revision + 1);
    assert.equal(edited.blocks[0]!.revision, 2);

    const restarted = new CanvasService(new WorkspaceFile(path));
    const retry = await restarted.execute(access, request);
    assert.deepEqual(retry, {
        ok: true,
        value: receipt,
    });
    assert.deepEqual(await execute(request), receipt);
    assert.deepEqual(await read(), edited);
    assert.equal(events.length, 2);
    const reuse = await service.execute(access, {
        ...request,
        changes: [
            {
                type: "update",
                id: "a",
                data: { count: 2 },
                expectedDataRevision: 1,
            },
        ],
    });
    assert.ok(!reuse.ok);
    assert.equal(reuse.error.code, "REQUEST_ID_REUSED");
});

void test("stale data rejects the entire batch without a receipt, notification, or partial write", async t => {

    const { service, access, execute, read } = await setup(t);
    await execute({
        type: "render",
        requestId: "first-data",
        canvasId: "synthetic-canvas",
        expectedRevision: 1,
        changes: [
            {
                type: "update",
                id: "b",
                data: { count: 1 },
                expectedDataRevision: 0,
            },
        ],
    });
    const before = await read();
    const events: CanvasChange[] = [];
    service.subscribe(event => {

        events.push(event);
    });

    const result = await service.execute(access, {
        type: "render",
        requestId: "stale-data",
        canvasId: before.id,
        expectedRevision: before.revision,
        changes: [
            {
                type: "update",
                id: "a",
                data: { count: 2 },
                expectedDataRevision: 0,
            },
            {
                type: "update",
                id: "b",
                data: { count: 2 },
                expectedDataRevision: 0,
            },
        ],
    });

    assert.ok(!result.ok);
    assert.equal(result.error.code, "INVALID_ARGUMENT");
    assert.deepEqual(await read(), before);
    assert.equal(await execute({
        type: "receipt",
        requestId: "stale-data",
    }), null);
    assert.equal(events.length, 0);
});

void test("mixed and metadata updates advance the canvas revision once and retain stale-source rejection", async t => {

    const { service, access, execute, read } = await setup(t);

    await execute({
        type: "render",
        requestId: "mixed",
        canvasId: "synthetic-canvas",
        expectedRevision: 1,
        changes: [
            {
                type: "update",
                id: "a",
                data: { count: 1 },
                expectedDataRevision: 0,
            },
            {
                type: "update",
                id: "b",
                source: {
                    html: "<p>Updated synthetic</p>",
                    css: "",
                    js: "",
                },
            },
        ],
    });
    const mixed = await read();
    assert.equal(mixed.revision, 2);
    assert.equal(mixed.blocks[0]!.dataRevision, 1);
    assert.equal(mixed.blocks[1]!.revision, 2);

    await execute({
        type: "render",
        requestId: "metadata",
        canvasId: mixed.id,
        expectedRevision: 2,
        changes: [
            {
                type: "update",
                id: "a",
                data: { count: 2 },
                expectedDataRevision: 1,
                description: "Updated synthetic description",
            },
        ],
    });
    const metadata = await read();
    assert.equal(metadata.revision, 3);
    const stale = await service.execute(access, {
        type: "render",
        requestId: "stale-source",
        canvasId: mixed.id,
        expectedRevision: 2,
        changes: [
            {
                type: "update",
                id: "b",
                source: {
                    html: "<p>Stale synthetic</p>",
                    css: "",
                    js: "",
                },
            },
        ],
    });
    assert.ok(!stale.ok);
    assert.equal(stale.error.code, "REVISION_CONFLICT");
    assert.deepEqual(await read(), metadata);
});

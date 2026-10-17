/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Integration
 * @description Agent Execution.test
 */

import { openAgentGateway } from "../../src/main/agent/agent-gateway";
import { CanvasService } from "../../src/main/canvas/canvas-service";
import type { WorkspaceFile } from "../../src/main/storage/workspace-file";
import type { WorkspaceSnapshot } from "@avesd/workspace-model";
import assert from "node:assert/strict";
import { test } from "node:test";

function deferred() {

    let resolve!: () => void;
    const promise = new Promise<void>(done => {

        resolve = done;
    });

    return {
        promise,
        resolve,
    };
}

void test("relay rejects stale runs and in-flight authorization stays bound to its run", async () => {

    let current: string | undefined = "run-one";
    const entered = deferred();
    const release = deferred();
    const gateway = await openAgentGateway(async (_name, _input, active) => {

        entered.resolve();
        await release.promise;

        return {
            content: [
                {
                    type: "text",
                    text: String(active()),
                },
            ],
        };
    }, undefined, id => {

        return () => {

            return current !== undefined && current === id;
        };
    });
    const invoke = (executionId?: string) => {

        return fetch(gateway.url, {
            method: "POST",
            headers: {
                authorization: `Bearer ${gateway.token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                name: "test",
                input: {},
                executionId,
            }),
        });
    };
    try {
        assert.equal((await invoke()).status, 403);
        assert.equal((await invoke("wrong-run")).status, 403);
        const pending = invoke("run-one");
        await entered.promise;
        current = "run-two";
        release.resolve();
        const result = await (await pending).json() as {
            content: {
                text: string;
            }[];
        };
        assert.equal(result.content[0]!.text, "false");
        assert.equal((await invoke("run-one")).status, 403);
        assert.equal((await invoke("run-two")).status, 200);
        current = undefined;
        assert.equal((await invoke("run-two")).status, 403);
    } finally {
        release.resolve();
        gateway.close();
    }
});

void test("HTTP canvas routes reject missing or stale execution IDs", async () => {

    let current = "run-one";
    const file: Pick<WorkspaceFile, "readService" | "transaction"> = {
        async readService() {

            return {
                snapshot: undefined,
                metadata: {},
            };
        },
        async transaction() {

            throw new Error("No writes expected");
        },
    };
    const gateway = await openAgentGateway(async () => {

        return { content: [] };
    }, {
        service: new CanvasService(file),
        access: {
            clientId: "test",
            canvasIds: "all",
        },
    }, id => {

        return () => {

            return id === current;
        };
    });
    try {
        const get = (executionId: string) => {

            return fetch(new URL("/v1/canvases", gateway.url), {
                headers: {
                    authorization: `Bearer ${gateway.token}`,
                    "x-avesd-execution-id": executionId,
                },
            });
        };
        assert.equal((await get("")).status, 401);
        current = "run-two";
        assert.equal((await get("run-one")).status, 401);
        assert.notEqual((await get("run-two")).status, 401);
    } finally {
        gateway.close();
    }
});

void test("revocation before the storage transaction prevents the canvas mutation", async () => {

    let active = true;
    let committed = false;
    const entered = deferred();
    const release = deferred();
    const snapshot = {
        workspaces: [],
        dashboards: [],
        widgets: [],
    } as unknown as WorkspaceSnapshot;
    const file: Pick<WorkspaceFile, "readService" | "transaction"> = {
        async readService() {

            return {
                snapshot,
                metadata: {},
            };
        },
        async transaction(change) {

            entered.resolve();
            await release.promise;
            const next = change(snapshot, {});
            committed = true;

            return next.result;
        },
    };
    const service = new CanvasService(file);
    const pending = service.execute({
        clientId: "test",
        canvasIds: "all",
        isActive: () => {

            return active;
        },
    }, {
        type: "create",
        requestId: "cancelled-request",
        title: "Test canvas",
    });
    await entered.promise;
    active = false;
    release.resolve();
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "UNAUTHENTICATED");
    assert.equal(committed, false);
});

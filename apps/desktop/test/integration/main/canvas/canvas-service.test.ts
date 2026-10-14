import { openAgentGateway } from "../../../../src/main/agent/agent-gateway";
import { CanvasService } from "../../../../src/main/canvas/canvas-service";
import { canvasToolDefinitions, invokeCanvasTool } from "../../../../src/main/canvas/canvas-tools";
import { WorkspaceFile } from "../../../../src/main/storage/workspace-file";
import type { CanvasChange, CanvasResult } from "../../../../src/shared/canvas/contracts";
import { navigateWorkspace, readCanvas } from "@avesd/workspace-model";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import * as z from "zod";

const directories: string[] = [];
const closers: (() => void)[] = [];
const access = {
    clientId: "synthetic-client",
    canvasIds: "all" as const,
};
afterEach(async () => {

    closers.splice(0).forEach(close => {

        close();
    });
    await Promise.all(directories.splice(0).map(path => {

        return rm(path, {
            recursive: true,
            force: true,
        });
    }));
});
async function fixture() {

    const directory = await mkdtemp(join(tmpdir(), "avesd-canvas-service-"));
    directories.push(directory);
    const file = new WorkspaceFile(join(directory, "workspace.json"));
    const { snapshot } = await navigateWorkspace(undefined, { type: "inspect" }, () => {

        return crypto.randomUUID();
    });
    await file.save(snapshot);
    const service = new CanvasService(file);

    return {
        file,
        service,
        original: snapshot.dashboards[0]!.id,
    };
}
function value(result: CanvasResult) {

    if (!result.ok) {
        throw new Error(JSON.stringify(result.error));
    }

    return result.value;
}
it("edits an inactive canvas without navigating and preserves receipts through restart and legacy saves", async () => {

    const { file, service, original } = await fixture();
    const created = value(await service.execute(access, {
        type: "create",
        requestId: "create-1",
        title: "Synthetic second canvas",
    }));
    if (!created || !("canvasId" in created)) {
        throw new Error("Missing receipt");
    }
    const command = {
        type: "apply",
        requestId: "edit-1",
        canvasId: created.canvasId,
        expectedRevision: 0,
        operations: [
            {
                type: "add",
                item: {
                    id: "synthetic-item",
                    content: {
                        kind: "idea",
                        version: 1,
                        text: "Synthetic content",
                    },
                    placement: {
                        x: 0,
                        y: 0,
                        width: 220,
                        height: 140,
                    },
                },
            },
        ],
    };
    const events: CanvasChange[] = [];
    service.subscribe(event => {

        events.push(event);
    });
    const [
        first,
        duplicate,
    ] = await Promise.all([
        service.execute(access, command),
        service.execute(access, command),
    ]);
    expect(first).toEqual(duplicate);
    expect(events).toHaveLength(1);
    const snapshot = (await file.load())!;
    expect(snapshot.selection?.dashboardId).toBe(original);
    expect(readCanvas(snapshot.dashboards.find(item => {

        return item.id === created.canvasId;
    })!)).toMatchObject({
        revision: 1,
        items: [{ id: "synthetic-item" }],
    });
    expect(snapshot).not.toHaveProperty("canvasService");
    await file.save(snapshot, { snapshot });
    const restarted = new CanvasService(file);
    expect(await restarted.execute(access, command)).toEqual(first);
    expect(value(await restarted.execute(access, {
        type: "receipt",
        requestId: "edit-1",
    }))).toEqual(value(first));
    expect(await restarted.execute(access, {
        ...command,
        operations: [{ type: "undo" }],
    })).toMatchObject({
        ok: false,
        error: { code: "REQUEST_ID_REUSED" },
    });
});
it("rejects stale, unauthorized, and invalid batches without partial effects", async () => {

    const { file, service, original } = await fixture();
    const denied = {
        clientId: "restricted",
        canvasIds: [],
    };
    expect(value(await service.execute(denied, { type: "list" }))).toEqual({ canvases: [] });
    expect(await service.execute(denied, {
        type: "read",
        canvasId: original,
    })).toMatchObject({
        ok: false,
        error: { code: "NOT_FOUND" },
    });
    expect(await service.execute(denied, {
        type: "create",
        requestId: "denied",
        title: "Denied",
    })).toMatchObject({
        ok: false,
        error: { code: "FORBIDDEN" },
    });
    const rename = {
        type: "rename",
        canvasId: original,
        expectedRevision: 0,
        title: "Renamed synthetic canvas",
    };
    expect(await service.execute(access, {
        ...rename,
        requestId: "rename-1",
    })).toMatchObject({ ok: true });
    expect(await service.execute(access, {
        ...rename,
        requestId: "rename-2",
    })).toMatchObject({
        ok: false,
        error: {
            code: "REVISION_CONFLICT",
            currentRevision: 1,
        },
    });
    const before = await file.load();
    expect(await service.execute(access, {
        type: "apply",
        requestId: "invalid",
        canvasId: original,
        expectedRevision: 1,
        operations: [
            {
                type: "add",
                item: {
                    id: "valid",
                    content: {
                        kind: "idea",
                        version: 1,
                        text: "Synthetic",
                    },
                    placement: {
                        x: 0,
                        y: 0,
                        width: 200,
                        height: 120,
                    },
                },
            },
            {
                type: "move",
                id: "missing",
                x: 0,
                y: 0,
            },
        ],
    })).toMatchObject({
        ok: false,
        error: { code: "INVALID_ARGUMENT" },
    });
    expect(await file.load()).toEqual(before);
    expect(value(await service.execute(denied, {
        type: "receipt",
        requestId: "rename-1",
    }))).toBeNull();
});
it("exposes authenticated versioned HTTP, an initial event reset, and committed invalidations", async () => {

    const { service, original } = await fixture();
    const gateway = await openAgentGateway(async () => {

        return { content: [] };
    }, {
        service,
        access,
    });
    closers.push(() => {

        gateway.close();
    });
    const base = new URL("/v1/", gateway.url);
    expect((await fetch(new URL("canvases", base))).status).toBe(401);
    const headers = {
        authorization: `Bearer ${gateway.token}`,
        "content-type": "application/json",
    };
    expect((await fetch(new URL("canvases", base), {
        headers: {
            ...headers,
            origin: "https://untrusted.example",
        },
    })).status).toBe(401);
    const listed = await fetch(new URL("canvases", base), { headers });
    expect(await listed.json()).toMatchObject({
        ok: true,
        value: { canvases: [{ id: original }] },
    });
    const abort = new AbortController();
    closers.push(() => {

        abort.abort();
    });
    const events = await fetch(new URL("events", base), {
        headers,
        signal: abort.signal,
    });
    const reader = events.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"type":"reset"');
    const renamed = await fetch(new URL(`canvases/${original}/rename`, base), {
        method: "POST",
        headers,
        body: JSON.stringify({
            requestId: "http-rename",
            expectedRevision: 0,
            title: "Synthetic HTTP canvas",
        }),
    });
    expect(renamed.status).toBe(200);
    expect(new TextDecoder().decode((await reader.read()).value)).toContain('"type":"canvas.renamed"');
    abort.abort();
    const conflict = await fetch(new URL(`canvases/${original}/rename`, base), {
        method: "POST",
        headers,
        body: JSON.stringify({
            requestId: "http-stale",
            expectedRevision: 0,
            title: "Stale",
        }),
    });
    expect(conflict.status).toBe(409);
});

it("rechecks access inside queued transactions and does not publish failed saves", async () => {

    const { file, original } = await fixture();
    let active = true;
    const delayed = new CanvasService({
        readService: () => {

            return file.readService();
        },
        transaction: operation => {

            active = false;

            return file.transaction(operation);
        },
    });
    const events: CanvasChange[] = [];
    delayed.subscribe(event => {

        events.push(event);
    });
    const command = {
        type: "rename",
        requestId: "revoked",
        canvasId: original,
        expectedRevision: 0,
        title: "Must not commit",
    };
    expect(await delayed.execute({
        ...access,
        isActive: () => {

            return active;
        },
    }, command)).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
    });
    expect(readCanvas((await file.load())!.dashboards[0]!).revision).toBe(0);
    expect(events).toHaveLength(0);
    const unavailable = new CanvasService({
        readService: () => {

            return file.readService();
        },
        transaction: async () => {

            throw new Error("Synthetic save failure");
        },
    });
    unavailable.subscribe(event => {

        events.push(event);
    });
    expect(await unavailable.execute(access, command)).toMatchObject({
        ok: false,
        error: { code: "UNAVAILABLE" },
    });
    expect(events).toHaveLength(0);
});

it("routes controller tools with explicit IDs and exposes an object MCP schema", async () => {

    const { service, original } = await fixture();
    expect(z.toJSONSchema(canvasToolDefinitions.avesd_canvases.schema)).toMatchObject({
        type: "object",
        required: ["request"],
    });
    const presented: string[] = [];
    const present = async (canvasId: string) => {

        presented.push(canvasId);

        return {
            viewId: 1,
            canvasId,
        };
    };
    const listed = await invokeCanvasTool(service, access, present, "avesd_canvases", { request: { type: "list" } });
    expect(listed.isError).toBeUndefined();
    const output = listed.content[0];
    expect(JSON.parse(output?.type === "text" ? output.text : "null")).toMatchObject({ canvases: [{ id: original }] });
    await invokeCanvasTool(service, access, present, "avesd_open_canvas", { canvasId: original });
    expect(presented).toEqual([original]);
    await expect(invokeCanvasTool(service, access, present, "avesd_inspect_canvas", {})).rejects.toThrow("explicit canvas tools");
});

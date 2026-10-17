/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Preload
 * @description Canvas Api.test
 */

import { createCanvasApi } from "../../../src/preload/canvas-view-api";
import type { PreloadIpc } from "../../../src/preload/preload-ipc";
import { dashboardBlocksChannels } from "../../../src/shared/canvas/blocks";
import { canvasServiceChannels } from "../../../src/shared/canvas/contracts";
import { desktopViewChannels } from "../../../src/shared/canvas/views";
import { createWindowClient } from "@avesd/desktop-contracts/ipc-result";
import type { CanvasApi } from "@avesd/renderer-canvas/contracts";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("canvas bridge exposes only scoped capabilities and preserves IPC requests", async () => {

    const calls: unknown[] = [];
    const ipc = {
        invoke: async (channel: string, ...args: unknown[]) => {

            calls.push([
                channel,
                ...args,
            ]);

            return {
                ok: true,
                value: { id: "synthetic-canvas" },
            };
        },
    } as PreloadIpc;
    const api = createWindowClient<CanvasApi>(createCanvasApi(ipc));
    assert.deepEqual(Object.keys(api).sort(), [
        "blocks",
        "canvases",
        "views",
    ]);
    assert.deepEqual(Object.keys(api.canvases).sort(), [
        "read",
        "subscribe",
    ]);
    assert.deepEqual(Object.keys(api.blocks).sort(), [
        "invoke",
        "subscribe",
    ]);
    assert.deepEqual(Object.keys(api.views).sort(), [
        "controller",
        "inspect",
        "subscribe",
    ]);
    assert.deepEqual(await api.canvases.read("synthetic-canvas"), { id: "synthetic-canvas" });
    await api.blocks.invoke({ type: "mount_canvas" });
    await api.views.controller(true);
    assert.deepEqual(calls, [
        [
            canvasServiceChannels.request,
            {
                type: "read",
                canvasId: "synthetic-canvas",
            },
        ],
        [
            dashboardBlocksChannels.request,
            { type: "mount_canvas" },
        ],
        [
            desktopViewChannels.request,
            {
                type: "controller",
                expanded: true,
            },
        ],
    ]);

});

void test("canvas subscriptions discard Electron events and detach only their own listener", () => {

    let receive: ((...args: unknown[]) => void) | undefined;
    let detached: unknown;
    const ipc = {
        on: (_channel: string, listener: (...args: unknown[]) => void) => {

            receive = listener;
        },
        off: (_channel: string, listener: unknown) => {

            detached = listener;
        },
    } as unknown as PreloadIpc;
    const api = createWindowClient<CanvasApi>(createCanvasApi(ipc));
    const observed: unknown[] = [];
    const unsubscribe = api.canvases.subscribe(change => {

        observed.push(change);
    });
    const change = {
        type: "reset",
        epoch: "test",
        sequence: 1,
    };
    receive!({ sender: "privileged-event" }, change);
    assert.deepEqual(observed, [change]);
    unsubscribe();
    assert.equal(detached, receive);
});

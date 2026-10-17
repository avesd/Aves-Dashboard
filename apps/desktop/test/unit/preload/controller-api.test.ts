/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Preload
 * @description Controller Api.test
 */

import { createControllerApi } from "../../../src/preload/controller-api";
import type { PreloadIpc } from "../../../src/preload/preload-ipc";
import { agentSessionsChannels } from "../../../src/shared/agent/sessions";
import { liveChannels } from "../../../src/shared/voice/live";
import { createWindowClient } from "@avesd/desktop-contracts/ipc-result";
import { settingsChannels } from "@avesd/desktop-contracts/settings";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";
import assert from "node:assert/strict";
import { test } from "node:test";

void test("controller composes its capabilities without legacy or canvas mutation APIs", async () => {

    const calls: unknown[] = [];
    const ipc = {
        invoke: async (channel: string, ...args: unknown[]) => {

            calls.push([
                channel,
                ...args,
            ]);

            return {
                ok: true,
                value: undefined,
            };
        },
    } as PreloadIpc;
    const api = createWindowClient<ControllerApi>(createControllerApi(ipc));
    await api.agentSessions.prompt("synthetic-session", "synthetic prompt");
    await api.agentSessions.enqueue("synthetic-session", "addition");
    await api.agentSessions.cancelTurn("synthetic-session");
    await api.voice.availability();
    await api.settings.open();
    assert.deepEqual(calls, [
        [
            agentSessionsChannels.command,
            {
                type: "prompt",
                id: "synthetic-session",
                text: "synthetic prompt",
            },
        ],
        [
            agentSessionsChannels.command,
            {
                type: "enqueue",
                id: "synthetic-session",
                text: "addition",
            },
        ],
        [
            agentSessionsChannels.command,
            {
                type: "cancelTurn",
                id: "synthetic-session",
            },
        ],
        [
            liveChannels.command,
            { type: "availability" },
        ],
        [settingsChannels.open],
    ]);
    assert.deepEqual(Object.keys(api).sort(), [
        "agentProviders",
        "agentSessions",
        "canvases",
        "settings",
        "views",
        "voice",
    ]);
    assert.deepEqual(Object.keys(api.canvases).sort(), [
        "list",
        "subscribe",
    ]);
    assert.deepEqual(Object.keys(api.agentProviders), ["list"]);
    assert.equal("configure" in api.agentSessions, false);
    assert.equal("cancel" in api.agentSessions, false);
    assert.equal("close" in api.views, false);
    assert.equal("list" in api.views, false);
});

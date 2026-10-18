/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Integration
 * @description Desktop Ipc.test
 */

import { registerAgentIpc } from "../../src/main/ipc/agent-ipc";
import { registerBrowserIpc } from "../../src/main/ipc/browser-ipc";
import { registerCanvasIpc } from "../../src/main/ipc/canvas-ipc";
import { registerPluginsIpc } from "../../src/main/ipc/plugins-ipc";
import { registerSettingsIpc } from "../../src/main/ipc/settings-ipc";
import { registerVoiceIpc } from "../../src/main/ipc/voice-ipc";
import { registerWorkspaceIpc } from "../../src/main/ipc/workspace-ipc";
import { dashboardBlocksChannels } from "../../src/shared/canvas/blocks";
import { canvasServiceChannels } from "../../src/shared/canvas/contracts";
import { desktopViewChannels } from "../../src/shared/canvas/views";
import { IpcErrorCode, OperationError, unwrapIpcResult } from "@avesd/desktop-contracts/ipc-result";
import { settingsChannels } from "@avesd/desktop-contracts/settings";
import type { IpcMain, IpcMainInvokeEvent } from "electron";
import assert from "node:assert/strict";
import { test } from "node:test";

function registry() {

    const handlers = new Map<string, Parameters<IpcMain["handle"]>[1]>();
    const ipc: Pick<IpcMain, "handle"> = {
        handle(channel, handler) {

            assert.equal(handlers.has(channel), false, "Channels must have one owner");
            handlers.set(channel, handler);
        },
    };
    const invoke = async (channel: string, input: unknown) => {

        const handler = handlers.get(channel);
        assert.ok(handler, channel);

        const result = await handler({} as IpcMainInvokeEvent, input);

        return result && typeof result === "object" && "ok" in result ? unwrapIpcResult(result) : result;
    };

    return {
        ipc,
        handlers,
        invoke,
    };
}

void test("all extracted controller and settings handlers retain sender authorization", async () => {

    const { ipc, handlers, invoke } = registry();
    const deny = () => {

        throw new OperationError(IpcErrorCode.PermissionDenied, "Untrusted sender");
    };
    function install<T>(register: (ipc: Pick<IpcMain, "handle">, getServices: () => T) => void) {

        register(ipc, () => {

            return {
                authorizeController: deny,
                settingsWindow: { authorize: deny },
            } as T;
        });
    }
    install(registerAgentIpc);
    install(registerBrowserIpc);
    install(registerPluginsIpc);
    install(registerSettingsIpc);
    install(registerVoiceIpc);
    install(registerWorkspaceIpc);
    assert.equal(handlers.size, 29);
    for (const channel of handlers.keys()) {
        await assert.rejects(invoke(channel, "synthetic-id"), /Untrusted sender/, channel);
    }
});

void test("canvas registrations retain scope, lease ownership and cross-window restrictions", async () => {

    const { ipc, invoke } = registry();
    let view: {
        viewId: number;
        canvasId?: string;
    } = {
        viewId: 1,
        canvasId: "canvas-a",
    };
    let denied = false;
    const calls: unknown[] = [];
    const services = {
        windows: {
            inspect: () => {

                if (denied) {
                    throw new OperationError(IpcErrorCode.PermissionDenied, "Untrusted sender");
                }

                return view;
            },
            expand: (expanded: boolean) => {

                calls.push([
                    "expand",
                    expanded,
                ]);
            },
            close: (id: number) => {

                calls.push([
                    "close",
                    id,
                ]);
            },
            open: (id: string) => {

                calls.push([
                    "open",
                    id,
                ]);
            },
        },
        canvasService: {
            execute: async (access: unknown, input: unknown) => {

                calls.push([
                    access,
                    input,
                ]);

                return {
                    ok: true,
                    value: undefined,
                };
            },
        },
        blockRuntime: {
            invoke: async (_sender: unknown, canvasId: string, request: unknown) => {

                calls.push([
                    canvasId,
                    request,
                ]);
            },
        },
    } as unknown as ReturnType<Parameters<typeof registerCanvasIpc>[1]>;
    registerCanvasIpc(ipc, () => {

        return services;
    });
    await invoke(canvasServiceChannels.request, {
        type: "read",
        canvasId: "canvas-a",
    });
    await invoke(dashboardBlocksChannels.request, { type: "mount_canvas" });
    assert.deepEqual(calls, [
        [
            {
                clientId: "desktop",
                canvasIds: ["canvas-a"],
            },
            {
                type: "read",
                canvasId: "canvas-a",
            },
        ],
        [
            "canvas-a",
            { type: "mount_canvas" },
        ],
    ]);
    await assert.rejects(invoke(desktopViewChannels.request, {
        type: "open",
        canvasId: "canvas-b",
    }), {
        name: "IpcError",
        code: IpcErrorCode.PermissionDenied,
    });
    await assert.rejects(invoke(desktopViewChannels.request, {
        type: "close",
        viewId: 2,
    }), {
        name: "IpcError",
        code: IpcErrorCode.PermissionDenied,
    });
    await invoke(desktopViewChannels.request, {
        type: "controller",
        expanded: true,
    });
    await invoke(desktopViewChannels.request, {
        type: "close",
        viewId: 1,
    });
    view = { viewId: 2 };
    await assert.rejects(invoke(dashboardBlocksChannels.request, { type: "mount_canvas" }), /Only a canvas/);
    await invoke(desktopViewChannels.request, {
        type: "open",
        canvasId: "canvas-b",
    });
    assert.deepEqual(calls.slice(2), [
        [
            "expand",
            true,
        ],
        [
            "close",
            1,
        ],
        [
            "open",
            "canvas-b",
        ],
    ]);
    denied = true;
    for (const channel of [
        canvasServiceChannels.request,
        dashboardBlocksChannels.request,
        desktopViewChannels.request,
    ]) {
        await assert.rejects(invoke(channel, {}), /Untrusted sender/);
    }
});

void test("settings IPC resolves current services per request rather than capturing startup state", async () => {

    const { ipc, invoke } = registry();
    let services: ReturnType<Parameters<typeof registerSettingsIpc>[1]> = {
        settingsWindow: undefined,
    } as ReturnType<Parameters<typeof registerSettingsIpc>[1]>;
    registerSettingsIpc(ipc, () => {

        return services;
    });
    await assert.rejects(invoke(settingsChannels.command, { type: "read" }), {
        name: "IpcError",
        code: IpcErrorCode.ServiceNotReady,
    });
    services = {
        settingsWindow: {
            authorize: () => {
            },
        },
        agentPreferences: {
            routes: {},
            revision: 7,
        },
    } as unknown as typeof services;
    assert.deepEqual(await invoke(settingsChannels.command, { type: "read" }), {
        routes: {},
        revision: 7,
    });
});

void test("non-Agent commands work before Agent initialization while execution still requires the service", async () => {

    const { ipc, invoke } = registry();
    let authorized = 0;
    let opened = 0;
    let requestedAgent = 0;
    const authorizeController = () => {

        authorized += 1;
    };
    const getAgentSessions = () => {

        requestedAgent += 1;
        throw new OperationError(IpcErrorCode.ServiceNotReady, "Agent sessions are unavailable.");
    };
    const routes = {
        flagship: {
            providerId: "deepseek",
            modelId: "",
            effortId: "",
        },
        reasoning: {
            providerId: "deepseek",
            modelId: "",
            effortId: "",
        },
        action: {
            providerId: "deepseek",
            modelId: "",
            effortId: "",
        },
    };
    registerAgentIpc(ipc, () => {

        return {
            authorizeController,
            getAgentSessions,
            agentPreferences: { routes },
        } as unknown as ReturnType<Parameters<typeof registerAgentIpc>[1]>;
    });
    registerSettingsIpc(ipc, () => {

        return {
            authorizeController,
            settingsWindow: {
                open: () => {

                    opened += 1;
                },
            },
        } as unknown as ReturnType<Parameters<typeof registerSettingsIpc>[1]>;
    });
    await invoke(settingsChannels.open, undefined);
    assert.equal(opened, 1);
    assert.deepEqual(await invoke("agent-sessions:command", { type: "routes" }), routes);
    assert.ok(Array.isArray(await invoke("agent-providers:list", false)));
    assert.equal(requestedAgent, 0);
    await assert.rejects(invoke("agent-sessions:command", { type: "list" }), /Agent sessions are unavailable/);
    assert.equal(requestedAgent, 1);
    assert.equal(authorized, 4);
});

void test("Agent IPC validates before service access and forwards normalized execution commands", async () => {

    const { ipc, invoke } = registry();
    const calls: unknown[] = [];
    let access = 0;
    const sessions = {
        prompt: async (text: string, id: string) => {

            calls.push([
                "prompt",
                text,
                id,
            ]);
        },
        enqueue: async (text: string, id: string) => {

            calls.push([
                "enqueue",
                text,
                id,
            ]);

            return { id: "queued" };
        },
        cancelTurn: async (id: string) => {

            calls.push([
                "cancelTurn",
                id,
            ]);
        },
    };
    registerAgentIpc(ipc, () => {

        return {
            authorizeController: () => {
            },
            getAgentSessions: () => {

                access += 1;

                return sessions;
            },
        } as unknown as ReturnType<Parameters<typeof registerAgentIpc>[1]>;
    });
    for (const request of [
        {
            type: "prompt",
            id: "",
            text: "hello",
        },
        {
            type: "prompt",
            id: "session",
            text: "x".repeat(32769),
        },
        {
            type: "create",
            tier: "unknown",
        },
        {
            type: "configureSession",
            id: "session",
            route: {
                providerId: "deepseek",
                modelId: 1,
                effortId: "",
            },
        },
        {
            type: "probeRoute",
            route: {
                providerId: "deepseek",
                modelId: "",
                effortId: "",
            },
            test: "false",
        },
        {
            type: "prompt",
            id: "session",
            text: " ",
        },
        {
            type: "enqueue",
            id: "session",
            text: 4,
        },
        {
            type: "cancelTurn",
            id: "session",
            executionId: "injected",
        },
        {
            type: "unknown",
            id: "session",
        },
    ]) {
        await assert.rejects(invoke("agent-sessions:command", request), {
            name: "IpcError",
            code: IpcErrorCode.InvalidArgument,
        });
    }
    assert.equal(access, 0);
    await invoke("agent-sessions:command", {
        type: "prompt",
        id: "session",
        text: "  hello  ",
    });
    assert.deepEqual(await invoke("agent-sessions:command", {
        type: "enqueue",
        id: "session",
        text: " addition ",
    }), { id: "queued" });
    await invoke("agent-sessions:command", {
        type: "cancelTurn",
        id: "session",
    });
    assert.deepEqual(calls, [
        [
            "prompt",
            "hello",
            "session",
        ],
        [
            "enqueue",
            "addition",
            "session",
        ],
        [
            "cancelTurn",
            "session",
        ],
    ]);
});

void test("settings IPC validates revision and routes before committing preferences", async () => {

    const { ipc, invoke } = registry();
    const calls: unknown[] = [];
    const route = {
        providerId: "deepseek",
        modelId: " model ",
        effortId: " effort ",
    };
    const routes = {
        flagship: route,
        reasoning: route,
        action: route,
    };
    registerSettingsIpc(ipc, () => {

        return {
            settingsWindow: {
                authorize: () => {
                },
            },
            agentPreferences: {
                configureRoutes: async (value: unknown, revision: number) => {

                    calls.push([
                        value,
                        revision,
                    ]);
                },
            },
        } as unknown as ReturnType<Parameters<typeof registerSettingsIpc>[1]>;
    });
    for (const revision of [
        undefined,
        -1,
        1.5,
        Number.MAX_SAFE_INTEGER + 1,
    ]) {
        await assert.rejects(invoke(settingsChannels.command, {
            type: "configure",
            routes,
            revision,
        }), { code: IpcErrorCode.InvalidArgument });
    }
    await assert.rejects(invoke(settingsChannels.command, {
        type: "read",
        routes,
    }), { code: IpcErrorCode.InvalidArgument });
    assert.equal(calls.length, 0);
    await invoke(settingsChannels.command, {
        type: "configure",
        routes,
        revision: 2,
    });
    const normalized = {
        ...route,
        modelId: "model",
        effortId: "effort",
    };
    assert.deepEqual(calls, [
        [
            {
                flagship: normalized,
                reasoning: normalized,
                action: normalized,
            },
            2,
        ],
    ]);
});

void test("recorded block action failures become typed IPC failures", async () => {

    const { ipc, invoke } = registry();
    registerCanvasIpc(ipc, () => {

        return {
            windows: {
                inspect: () => {

                    return {
                        viewId: 1,
                        canvasId: "canvas-a",
                    };
                },
            },
            blockRuntime: {
                invoke: async () => {

                    return {
                        status: "error",
                        error: {
                            code: IpcErrorCode.PermissionDenied,
                            message: "Unregistered action",
                        },
                    };
                },
            },
        } as unknown as ReturnType<Parameters<typeof registerCanvasIpc>[1]>;
    });
    await assert.rejects(invoke(dashboardBlocksChannels.request, { type: "mount_canvas" }), {
        name: "IpcError",
        code: IpcErrorCode.PermissionDenied,
    });
});

void test("API key IPC authorizes before parsing, bounds secrets, and exposes no read-key command", async () => {

    const { ipc, invoke } = registry();
    let allowed = true;
    let writes = 0;
    registerSettingsIpc(ipc, () => {

        return {
            settingsWindow: {
                authorize: () => {

                    if (!allowed) {
                        throw new OperationError(IpcErrorCode.PermissionDenied, "Untrusted sender");
                    }
                },
            },
            apiKeys: {
                save: (id: string, key: string, revision: number, authorize: () => void) => {

                    authorize();
                    assert.equal(id, "openai");
                    assert.equal(key, "synthetic-key");
                    assert.equal(revision, 0);
                    writes += 1;
                },
                snapshot: () => {

                    return {
                        secureStorageAvailable: true,
                        providers: [
                            {
                                id: "openai",
                                revision: 1,
                                source: "saved",
                                hasSavedKey: true,
                            },
                        ],
                    };
                },
            },
        } as unknown as ReturnType<Parameters<typeof registerSettingsIpc>[1]>;
    });
    await invoke(settingsChannels.command, {
        type: "saveApiKey",
        id: "openai",
        key: "  synthetic-key  ",
        revision: 0,
    });
    assert.equal(writes, 1);
    assert.equal(JSON.stringify(await invoke(settingsChannels.command, { type: "apiKeys" })).includes("synthetic-key"), false);
    for (const request of [
        {
            type: "saveApiKey",
            id: "unknown",
            key: "synthetic-key",
            revision: 0,
        },
        {
            type: "saveApiKey",
            id: "openai",
            key: "synthetic\nkey",
            revision: 0,
        },
        {
            type: "saveApiKey",
            id: "openai",
            key: " ",
            revision: 0,
        },
        {
            type: "saveApiKey",
            id: "openai",
            key: "x".repeat(4097),
            revision: 0,
        },
        {
            type: "readApiKey",
            id: "openai",
        },
    ]) {
        await assert.rejects(invoke(settingsChannels.command, request), {
            code: IpcErrorCode.InvalidArgument,
            message: "Invalid request parameters.",
        });
    }
    assert.equal(writes, 1);
    allowed = false;
    for (const type of [
        "apiKeys",
        "saveApiKey",
        "removeApiKey",
        "testApiKey",
    ]) {
        await assert.rejects(invoke(settingsChannels.command, { type }), { code: IpcErrorCode.PermissionDenied });
    }
});

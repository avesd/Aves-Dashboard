/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Shared
 * @description IPC Commands.types
 */

import { handleWindow } from "../../../src/main/ipc/ipc-result";
import type { BlockActionResult, BlockResults, BlockRuntimeRequest, CanvasSandboxMount, DashboardBlocksApi } from "@avesd/desktop-contracts/canvas/blocks";
import type { AgentSessionCommand, AgentSessionResults, CommandHandlers, SettingsCommand, SettingsResults, WindowWireInvoke } from "@avesd/desktop-contracts/ipc-commands";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import { createWindowClient, unwrapIpcResult } from "@avesd/desktop-contracts/ipc-result";
import type { CanvasApi } from "@avesd/renderer-canvas/contracts";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";
import type { IpcMain } from "electron";

/** Compile-only contract checks; intentionally never invoke a real transport. */
export async function checkWindowCommandTypes(invoke: WindowWireInvoke): Promise<void> {

    const voice: {
        configured: boolean;
    } = unwrapIpcResult(await invoke("live:command", { type: "availability" }));
    const session: {
        id: string;
    } = unwrapIpcResult(await invoke("agent-sessions:command", {
        type: "create",
        tier: "flagship",
    }));
    const settings: SettingsResults["read"] = unwrapIpcResult(await invoke("settings:command", { type: "read" }));
    const canvas = await invoke("canvas-service:request", {
        type: "read",
        canvasId: "a",
    });
    const canvasId: string = unwrapIpcResult(canvas).id;
    void canvasId;
    void voice;
    void session;
    void settings;
    // @ts-expect-error Each channel accepts only its own commands.
    await invoke("settings:command", {
        type: "cancelTurn",
        id: "a",
    });
    // @ts-expect-error Configuration requires the expected revision.
    await invoke("settings:command", {
        type: "configure",
        routes: settings.routes,
    });
    // @ts-expect-error The read result is a snapshot, not an identifier.
    const id: string = unwrapIpcResult(await invoke("agent-sessions:command", {
        type: "read",
        id: "a",
    }));
    // @ts-expect-error Main-process handlers must return the command's declared result.
    const read: CommandHandlers<SettingsCommand, SettingsResults>["read"] = () => {

        return "wrong";
    };
    // @ts-expect-error Enqueue returns a queued prompt identifier.
    const enqueue: CommandHandlers<AgentSessionCommand, AgentSessionResults>["enqueue"] = () => {

        return undefined;
    };
    void id;
    void read;
    void enqueue;
}

export async function checkRendererClientTypes(wire: WireApi<ControllerApi>): Promise<void> {

    const client = createWindowClient<ControllerApi>(wire);
    const voice: {
        configured: boolean;
    } = await client.voice.availability();
    // @ts-expect-error Renderer clients return domain results, not wire envelopes.
    void voice.ok;
    const dispose: () => void = client.settings.subscribe(() => {
    });
    dispose();
}

/** Public, wire, and composed clients must keep the same command-result relation. */
export async function checkBlockClientTypes(api: DashboardBlocksApi, wire: WireApi<DashboardBlocksApi>, canvasWire: WireApi<CanvasApi>): Promise<void> {

    const sandbox: CanvasSandboxMount = await api.invoke({ type: "mount_canvas" });
    const deliveries = await api.invoke({
        type: "snapshots",
        sandboxId: sandbox.sandboxId,
    });
    const leaseId: string | undefined = deliveries[0]?.leaseId;
    const canvasRelease: Promise<undefined> = api.invoke({
        type: "release_canvas",
        sandboxId: sandbox.sandboxId,
    });
    await canvasRelease;
    const wireSandbox: CanvasSandboxMount = unwrapIpcResult(await wire.invoke({ type: "mount_canvas" }));
    const client = createWindowClient<DashboardBlocksApi>(wire);
    const directSandbox: CanvasSandboxMount = await client.invoke({ type: "mount_canvas" });
    const canvas = createWindowClient<CanvasApi>(canvasWire);
    const composedSandbox: CanvasSandboxMount = await canvas.blocks.invoke({ type: "mount_canvas" });
    // @ts-expect-error A canvas mount is not a block action result.
    const action: BlockActionResult = await api.invoke({ type: "mount_canvas" });
    // @ts-expect-error Wire conversion must not widen the canvas mount result.
    void wireSandbox.executionId;
    // @ts-expect-error Composition must preserve the command's result shape.
    void composedSandbox.leaseId;
    // @ts-expect-error A release handler cannot return a mount, even though it belongs to the channel union.
    const release: CommandHandlers<BlockRuntimeRequest, BlockResults>["release"] = () => {

        return sandbox;
    };
    void leaseId;
    void directSandbox;
    void action;
    void release;
}

export function checkWindowRegistrationTypes(ipc: Pick<IpcMain, "handle">): void {

    // @ts-expect-error Registration accepts declared window channels only.
    handleWindow(ipc, "synthetic-window:command", () => {

        return undefined;
    });
    // @ts-expect-error Registration rejects a result from a different channel.
    handleWindow(ipc, "dashboard-blocks:request", () => {

        return true;
    });
}

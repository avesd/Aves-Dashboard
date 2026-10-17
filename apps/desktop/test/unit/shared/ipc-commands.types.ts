/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Shared
 * @description IPC Commands.types
 */

import type { AgentSessionCommand, AgentSessionResults, CommandHandlers, SettingsCommand, SettingsResults, WindowWireInvoke } from "@avesd/desktop-contracts/ipc-commands";
import type { WireApi } from "@avesd/desktop-contracts/ipc-result";
import { createWindowClient, unwrapIpcResult } from "@avesd/desktop-contracts/ipc-result";
import type { ControllerApi } from "@avesd/renderer-controller/contracts";

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

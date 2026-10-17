/**
 * @author Avesd
 * @package Renderer Canvas
 * @namespace Blocks
 * @description Sandbox Messages
 */

import type { MountedBlock } from "./mounted-block";
import type { BlockActionResult, CanvasSandboxInteraction, DashboardBlocksApi } from "@avesd/desktop-contracts/canvas/blocks";
import { blockRuntimeRequestSchema, canvasSandboxInteractionSchema } from "@avesd/desktop-contracts/canvas/blocks";
import { IpcError, IpcErrorCode, ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";

interface MessageContext {
    readonly api: DashboardBlocksApi;
    readonly isActive: () => boolean;
    readonly versions: ReadonlyMap<string, MountedBlock>;
    readonly connected: () => void;
    readonly interact: (event: CanvasSandboxInteraction) => void;
    readonly report: (id: string, status: MountedBlock["status"], failure?: "SCRIPT_ERROR" | "LOAD_TIMEOUT") => void;
    readonly release: (id: string) => void;
    readonly refresh: () => Promise<void>;
    readonly send: (message: unknown) => void;
}

export function createSandboxMessageHandler({ api, isActive, versions, connected, interact, report, release, refresh, send }: MessageContext) {

    return async ({ data }: MessageEvent<unknown>) => {

        if (!isActive() || !data || typeof data !== "object" || !("type" in data)) {
            return;
        }
        if (data.type === "connected") {
            connected();

            return;
        }
        if (data.type === "interaction") {
            const input: Record<string, unknown> = { ...data };
            delete input.type;
            const event = canvasSandboxInteractionSchema.safeParse(input);
            if (event.success) {
                interact(event.data);
            }

            return;
        }
        if (!("token" in data) || typeof data.token !== "string" || !versions.has(data.token)) {
            return;
        }
        const token = data.token;
        const version = versions.get(token)!;
        if (data.type === "ready" || data.type === "error") {
            clearTimeout(version.timeout);
            report(token, data.type === "ready" ? "ready" : "error", data.type === "error" ? "SCRIPT_ERROR" : undefined);
            if (data.type === "ready") {
                for (const [
                    id,
                    older,
                ] of versions) {
                    if (id !== token && older.block.id === version.block.id) {
                        release(id);
                    }
                }
            }

            return;
        }
        if ((data.type !== "action" && data.type !== "state") || !("requestId" in data) || typeof data.requestId !== "string") {
            return;
        }
        const requestId = data.requestId;
        const input: Record<string, unknown> = { ...data };
        delete input.token;
        delete input.requestId;
        try {
            const parsed = blockRuntimeRequestSchema.safeParse(data.type === "state"
                ? {
                    ...input,
                    leaseId: token,
                } : {
                    ...input,
                    requestId,
                    leaseId: token,
                });
            if (!parsed.success) {
                throw new IpcError({
                    code: IpcErrorCode.InvalidArgument,
                    message: "Invalid request parameters.",
                });
            }
            const result = await api.invoke(parsed.data) as BlockActionResult | undefined;
            send({
                type: "result",
                token,
                requestId,
                ok: true,
                result,
            });
            await refresh();
        } catch (cause) {
            send({
                type: "result",
                token,
                requestId,
                ok: false,
                error: ipcErrorMessage(cause, "Request was rejected; inspect the current data and action binding."),
                ...(cause instanceof IpcError ? { code: cause.code } : {}),
            });
        }
    };
}

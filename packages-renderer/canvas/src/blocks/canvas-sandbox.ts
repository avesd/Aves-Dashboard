/**
 * @author Avesd
 * @package Renderer Canvas
 * @namespace Blocks
 * @description Canvas Sandbox
 */

import type { MountedBlock } from "./mounted-block";
import { createSandboxMessageHandler } from "./sandbox-messages";
import type { BlockMount, BlockSnapshotDelivery, CanvasSandboxInteraction, CanvasSandboxMount, CanvasViewport, DashboardBlocksApi } from "@avesd/desktop-contracts/canvas/blocks";
import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import type { DashboardBlock } from "@avesd/workspace-model";

export interface CanvasBlockView {
    readonly blocks: readonly DashboardBlock[];
    readonly viewport: CanvasViewport;
    readonly interact: (event: CanvasSandboxInteraction) => void;
}

interface SandboxContext {
    readonly api: DashboardBlocksApi;
    readonly canvasId: string;
    readonly frame: () => HTMLIFrameElement | null;
    readonly view: () => CanvasBlockView;
    readonly sandbox: (mount: CanvasSandboxMount) => void;
    readonly error: (message: string | undefined) => void;
}

/** Owns one sandbox lifetime, including stale-mount release and serialized synchronization. */
export function createCanvasSandbox({ api, canvasId, frame, view, sandbox, error }: SandboxContext) {

    const lifecycle = { active: true };
    const isActive = () => {

        return lifecycle.active;
    };
    let mountedSandbox: CanvasSandboxMount | undefined;
    let channel: MessagePort | undefined;
    let connected = false;
    let synchronizing = false;
    let synchronizeAgain = false;
    let refreshing = false;
    let refreshAgain = false;
    let geometryTimer: ReturnType<typeof setTimeout> | undefined;
    const versions = new Map<string, MountedBlock>();
    const requested = new Map<string, string>();
    const layouts = new Map<string, string>();
    const release = (id: string) => {

        const version = versions.get(id);
        clearTimeout(version?.timeout);
        versions.delete(id);
        void api.invoke({
            type: "release",
            leaseId: id,
        }).catch(() => {
        });
    };
    const report = (id: string, status: "loading" | "ready" | "error", failure?: "SCRIPT_ERROR" | "LOAD_TIMEOUT") => {

        const version = versions.get(id);
        if (!version) {
            return;
        }
        version.status = status;
        const block = view().blocks.find(candidate => {

            return candidate.id === version.block.id;
        });
        const rect = frame()?.getBoundingClientRect();
        const viewport = view().viewport;
        void api.invoke({
            type: "report",
            leaseId: id,
            status,
            ...(failure ? { error: failure } : {}),
            ...(block && rect ? {
                rect: {
                    x: Math.floor(rect.x + viewport.x + block.bounds.x * viewport.zoom),
                    y: Math.floor(rect.y + viewport.y + block.bounds.y * viewport.zoom),
                    width: Math.min(8000, Math.ceil(block.bounds.width * viewport.zoom)),
                    height: Math.min(8000, Math.ceil(block.bounds.height * viewport.zoom)),
                },
            } : {}),
        }).catch(() => {
        });
    };
    const moveViewport = () => {

        if (!connected) {
            return;
        }
        channel?.postMessage({
            type: "viewport",
            ...view().viewport,
        });
        clearTimeout(geometryTimer);
        geometryTimer = setTimeout(() => {

            for (const [
                id,
                version,
            ] of versions) {
                if (version.status === "ready") {
                    report(id, "ready");
                }
            }
        }, 120);
    };
    const refresh = async () => {

        if (!isActive() || !connected || !mountedSandbox) {
            return;
        }
        if (synchronizing) {
            refreshAgain = true;

            return;
        }
        if (refreshing) {
            refreshAgain = true;

            return;
        }
        refreshing = true;
        try {
            const deliveries = await api.invoke({
                type: "snapshots",
                sandboxId: mountedSandbox.sandboxId,
            }) as readonly BlockSnapshotDelivery[];
            if (isActive()) {
                for (const { leaseId, snapshot } of deliveries) {
                    if (versions.has(leaseId)) {
                        channel?.postMessage({
                            type: "snapshot",
                            token: leaseId,
                            snapshot,
                        });
                    }
                }
            }
        } catch {
            // A closed canvas or replaced version no longer needs a snapshot.
        } finally {
            refreshing = false;
            if (refreshAgain) {
                refreshAgain = false;
                void refresh();
            }
        }
    };
    const sync = async () => {

        if (!isActive() || !connected) {
            return;
        }
        if (synchronizing) {
            synchronizeAgain = true;

            return;
        }
        synchronizing = true;
        try {
            for (const [id] of requested) {
                if (!view().blocks.some(block => {

                    return block.id === id;
                })) {
                    requested.delete(id);
                    layouts.delete(id);
                    channel?.postMessage({
                        type: "remove",
                        id,
                    });
                    for (const [
                        token,
                        version,
                    ] of versions) {
                        if (version.block.id === id) {
                            release(token);
                        }
                    }
                }
            }
            for (const block of view().blocks) {
                const layout = JSON.stringify(block.bounds);
                if (layouts.get(block.id) !== layout) {
                    layouts.set(block.id, layout);
                    channel?.postMessage({
                        type: "layout",
                        id: block.id,
                        bounds: block.bounds,
                    });
                }
                const key = `${block.generation}:${block.revision}`;
                if (requested.get(block.id) === key) {
                    continue;
                }
                requested.set(block.id, key);
                const mount = await api.invoke({
                    type: "mount",
                    canvasId,
                    blockId: block.id,
                    generation: block.generation,
                    revision: block.revision,
                }) as BlockMount;
                const current = view().blocks.find(candidate => {

                    return candidate.id === block.id;
                });
                if (!isActive() || !current || `${current.generation}:${current.revision}` !== key) {
                    void api.invoke({
                        type: "release",
                        leaseId: mount.leaseId,
                    }).catch(() => {
                    });
                    requested.delete(block.id);
                    synchronizeAgain = true;

                    continue;
                }
                const version: MountedBlock = {
                    block,
                    mount,
                    status: "loading",
                };
                versions.set(mount.leaseId, version);
                version.timeout = setTimeout(() => {

                    if (version.status === "loading") {
                        report(mount.leaseId, "error", "LOAD_TIMEOUT");
                    }
                }, 10_000);
                channel?.postMessage({
                    type: "upsert",
                    token: mount.leaseId,
                    id: block.id,
                    source: block.source,
                    bounds: block.bounds,
                    snapshot: mount.snapshot,
                });
            }
            moveViewport();
        } catch (cause) {
            if (isActive()) {
                error(ipcErrorMessage(cause, "Canvas blocks could not be loaded."));
            }
        } finally {
            synchronizing = false;
            refreshAgain = false;
            void refresh();
            if (synchronizeAgain) {
                synchronizeAgain = false;
                void sync();
            }
        }
    };
    const connect = () => {

        const contentWindow = frame()?.contentWindow;
        if (!mountedSandbox || !contentWindow || channel) {
            return;
        }
        const pair = new MessageChannel();
        channel = pair.port1;
        channel.onmessage = createSandboxMessageHandler({
            api,
            isActive,
            versions,
            connected: () => {

                connected = true;
                error(undefined);
                void sync();
            },
            interact: event => {

                view().interact(event);
            },
            report,
            release,
            refresh,
            send: message => {

                channel?.postMessage(message);
            },
        });
        channel.start();
        contentWindow.postMessage({ type: "aves:canvas:connect" }, "*", [pair.port2]);
    };
    const unsubscribe = api.subscribe(() => {

        void refresh();
    });
    void api.invoke({ type: "mount_canvas" }).then(value => {

        const mount = value as CanvasSandboxMount;
        if (!isActive()) {
            void api.invoke({
                type: "release_canvas",
                sandboxId: mount.sandboxId,
            }).catch(() => {
            });

            return;
        }
        mountedSandbox = mount;
        sandbox(mount);
    })
        .catch((cause) => {

            if (isActive()) {
                error(ipcErrorMessage(cause, "Canvas blocks could not be loaded."));
            }
        });

    const dispose = () => {

        lifecycle.active = false;
        clearTimeout(geometryTimer);
        unsubscribe();
        channel?.close();
        for (const version of versions.values()) {
            clearTimeout(version.timeout);
        }
        if (mountedSandbox) {
            void api.invoke({
                type: "release_canvas",
                sandboxId: mountedSandbox.sandboxId,
            }).catch(() => {
            });
        }
    };

    return {
        synchronize: sync,
        updateViewport: moveViewport,
        connect,
        dispose,
    };
}

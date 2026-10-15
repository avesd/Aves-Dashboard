import type { BlockActionResult, BlockMount, BlockSnapshotDelivery, CanvasSandboxInteraction, CanvasSandboxMount, CanvasViewport, DashboardBlocksApi } from "../../../shared/canvas/blocks";
import { blockRuntimeRequestSchema, canvasSandboxInteractionSchema } from "../../../shared/canvas/blocks";
import type { DashboardBlock } from "@avesd/workspace-model";
import { useEffect, useRef, useState } from "react";

interface MountedBlock {
    readonly block: DashboardBlock;
    readonly mount: BlockMount;
    status: "loading" | "ready" | "error";
    timeout?: ReturnType<typeof setTimeout>;
}
interface Props {
    readonly canvasId: string;
    readonly blocks: readonly DashboardBlock[];
    readonly api: DashboardBlocksApi;
    readonly viewport: CanvasViewport;
    readonly interact: (event: CanvasSandboxInteraction) => void;
}

/** One iframe and one message channel, with independently mounted block versions. */
export function CanvasBlocks({ canvasId, blocks, api, viewport, interact }: Props) {

    const frame = useRef<HTMLIFrameElement>(null);
    const latest = useRef({
        blocks,
        viewport,
        interact,
    });
    latest.current = {
        blocks,
        viewport,
        interact,
    };
    const [
        sandbox,
        setSandbox,
    ] = useState<CanvasSandboxMount>();
    const [
        error,
        setError,
    ] = useState(false);
    const synchronize = useRef<(() => void) | undefined>(undefined);
    const updateViewport = useRef<(() => void) | undefined>(undefined);
    const connect = useRef<(() => void) | undefined>(undefined);

    useEffect(() => {

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
            const block = latest.current.blocks.find(candidate => {

                return candidate.id === version.block.id;
            });
            const rect = frame.current?.getBoundingClientRect();
            const view = latest.current.viewport;
            void api.invoke({
                type: "report",
                leaseId: id,
                status,
                ...(failure ? { error: failure } : {}),
                ...(block && rect ? {
                    rect: {
                        x: Math.floor(rect.x + view.x + block.bounds.x * view.zoom),
                        y: Math.floor(rect.y + view.y + block.bounds.y * view.zoom),
                        width: Math.min(8000, Math.ceil(block.bounds.width * view.zoom)),
                        height: Math.min(8000, Math.ceil(block.bounds.height * view.zoom)),
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
                ...latest.current.viewport,
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
                    refreshAgain = false; void refresh();
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
                    if (!latest.current.blocks.some(block => {

                        return block.id === id;
                    })) {
                        requested.delete(id); layouts.delete(id); channel?.postMessage({
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
                for (const block of latest.current.blocks) {
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
                    const current = latest.current.blocks.find(candidate => {

                        return candidate.id === block.id;
                    });
                    if (!isActive() || !current || `${current.generation}:${current.revision}` !== key) {
                        void api.invoke({
                            type: "release",
                            leaseId: mount.leaseId,
                        }).catch(() => {
                        });
                        requested.delete(block.id); synchronizeAgain = true;

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
            } catch {
                if (isActive()) {
                    setError(true);
                }
            } finally {
                synchronizing = false; refreshAgain = false; void refresh();
                if (synchronizeAgain) {
                    synchronizeAgain = false; void sync();
                }
            }
        };
        synchronize.current = () => {

            void sync();
        };
        updateViewport.current = moveViewport;
        connect.current = () => {

            if (!mountedSandbox || !frame.current?.contentWindow || channel) {
                return;
            }
            const pair = new MessageChannel();
            channel = pair.port1;
            channel.onmessage = async ({ data }: MessageEvent<unknown>) => {

                if (!isActive() || !data || typeof data !== "object" || !("type" in data)) {
                    return;
                }
                if (data.type === "connected") {
                    connected = true; setError(false); void sync();

                    return;
                }
                if (data.type === "interaction") {
                    const input: Record<string, unknown> = { ...data };
                    delete input.type;
                    const event = canvasSandboxInteractionSchema.safeParse(input);
                    if (event.success) {
                        latest.current.interact(event.data);
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
                delete input.token; delete input.requestId;
                try {
                    const request = blockRuntimeRequestSchema.parse(data.type === "state"
                        ? {
                            ...input,
                            leaseId: token,
                        } : {
                            ...input,
                            requestId,
                            leaseId: token,
                        });
                    const result = await api.invoke(request) as BlockActionResult | undefined;
                    channel?.postMessage({
                        type: "result",
                        token,
                        requestId,
                        ok: true,
                        result,
                    });
                    await refresh();
                } catch {
                    channel?.postMessage({
                        type: "result",
                        token,
                        requestId,
                        ok: false,
                        error: "Request was rejected; inspect the current data and action binding.",
                    });
                }
            };
            channel.start();
            frame.current.contentWindow.postMessage({ type: "aves:canvas:connect" }, "*", [pair.port2]);
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
            mountedSandbox = mount; setSandbox(mount);
        })
            .catch(() => {

                if (isActive()) {
                    setError(true);
                }
            });

        return () => {

            lifecycle.active = false; clearTimeout(geometryTimer); unsubscribe(); channel?.close(); synchronize.current = undefined; updateViewport.current = undefined; connect.current = undefined;
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
    }, [
        api,
        canvasId,
    ]);
    useEffect(() => {

        synchronize.current?.();
    }, [blocks]);
    useEffect(() => {

        updateViewport.current?.();
    }, [viewport]);

    return <>
        <iframe
            ref={frame}
            src={sandbox?.url}
            sandbox="allow-scripts allow-forms"
            allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
            referrerPolicy="no-referrer"
            title="Canvas blocks"
            className="canvas-blocks-frame"
            onLoad={() => {

                connect.current?.();
            }}
        />
        {error && <div
            className="canvas-error"
            role="status"
        >
            Canvas blocks could not be loaded.
        </div>}
    </>;
}

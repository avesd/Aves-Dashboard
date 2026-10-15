import type { CanvasSandboxInteraction, DashboardBlocksApi } from "../../../shared/canvas/blocks";
import type { CanvasDocument, CanvasServiceApi } from "../../../shared/canvas/contracts";
import { CanvasBlocks } from "./CanvasBlocks";
import { DashboardMenu } from "./DashboardMenu";
import type { PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
    readonly api: Pick<CanvasServiceApi, "read" | "subscribe">;
    readonly canvasId: string;
    readonly blocksApi: DashboardBlocksApi;
    readonly openController: () => void;
}

export const CanvasShell = ({ api, canvasId, blocksApi, openController }: Props) => {

    const surface = useRef<HTMLDivElement>(null);
    const menuOrigin = useRef<HTMLElement | null>(null);
    const [
        canvas,
        setCanvas,
    ] = useState<CanvasDocument>();
    const [
        viewport,
        setViewport,
    ] = useState({
        x: 0,
        y: 0,
        zoom: 1,
    });
    const [
        error,
        setError,
    ] = useState<string>();
    const [
        menu,
        setMenu,
    ] = useState<{
        x: number;
        y: number;
    }>();
    const drag = useRef<{
        x: number;
        y: number;
        startX: number;
        startY: number;
    } | undefined>(undefined);
    const closeMenu = useCallback(() => {

        setMenu(undefined);
        const origin = menuOrigin.current;
        (origin?.isConnected ? origin : surface.current)?.focus({ preventScroll: true });
    }, []);
    const resetView = useCallback(() => {

        setViewport({
            x: 0,
            y: 0,
            zoom: 1,
        });
    }, []);
    useEffect(() => {

        let active = true;
        let generation = 0;
        const refresh = () => {

            const current = ++generation;
            void api.read(canvasId).then(value => {

                if (active && current === generation) {
                    setCanvas(previous => {

                        return !previous || value.revision >= previous.revision ? value : previous;
                    }); setError(undefined);
                }
            })
                .catch(cause => {

                    if (active && current === generation) {
                        setError(cause instanceof Error ? cause.message : "Dashboard could not be loaded.");
                    }
                });
        };
        const dispose = api.subscribe(change => {

            if (!change.canvasId || change.canvasId === canvasId) {
                refresh();
            }
        });
        refresh();

        return () => {

            active = false; dispose();
        };
    }, [
        api,
        canvasId,
    ]);
    useEffect(() => {

        const keyDown = (event: KeyboardEvent) => {

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault(); openController();
            } else if ((event.metaKey || event.ctrlKey) && event.key === "0") {
                event.preventDefault(); resetView();
            } else if (event.key === "Escape") {
                closeMenu();
            }
        };
        window.addEventListener("keydown", keyDown);

        return () => {

            window.removeEventListener("keydown", keyDown);
        };
    }, [
        closeMenu,
        openController,
        resetView,
    ]);
    useEffect(() => {

        const node = surface.current;
        if (!node) {
            return;
        }
        const wheel = (event: WheelEvent) => {

            event.preventDefault();
            setMenu(undefined);
            const rect = node.getBoundingClientRect();
            const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
            setViewport(current => {

                const zoom = Math.max(0.2, Math.min(3, current.zoom * Math.exp(-delta * 0.003)));
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;

                return {
                    x: x - (x - current.x) * zoom / current.zoom,
                    y: y - (y - current.y) * zoom / current.zoom,
                    zoom,
                };
            });
        };
        node.addEventListener("wheel", wheel, { passive: false });

        return () => {

            node.removeEventListener("wheel", wheel);
        };
    }, []);

    const interact = (event: CanvasSandboxInteraction) => {

        if (event.kind === "pan") {
            setMenu(undefined);
            setViewport(value => {

                return {
                    ...value,
                    x: value.x + event.dx,
                    y: value.y + event.dy,
                };
            });
        } else if (event.kind === "wheel") {
            setMenu(undefined);
            setViewport(value => {

                const zoom = Math.max(0.2, Math.min(3, value.zoom * Math.exp(-event.delta * 0.003)));

                return {
                    x: event.x - (event.x - value.x) * zoom / value.zoom,
                    y: event.y - (event.y - value.y) * zoom / value.zoom,
                    zoom,
                };
            });
        } else if (event.kind === "menu") {
            menuOrigin.current = surface.current;
            setMenu({
                x: event.x,
                y: event.y,
            });
        } else if (event.command === "controller") {
            openController();
        } else if (event.command === "reset") {
            resetView();
        } else {
            closeMenu();
        }
    };
    const onSurfaceDown = (event: PointerEvent<HTMLDivElement>) => {

        if (event.target !== event.currentTarget || event.button !== 0) {
            return;
        }
        event.currentTarget.focus({ preventScroll: true });
        setMenu(undefined);
        drag.current = {
            x: event.clientX,
            y: event.clientY,
            startX: viewport.x,
            startY: viewport.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    return <section
        className="canvas-shell"
        aria-label={canvas?.title ?? "Dashboard"}
    >
        {menu && <DashboardMenu
            x={menu.x}
            y={menu.y}
            close={closeMenu}
            actions={[
                {
                    label: "Reset view",
                    run: resetView,
                },
                {
                    label: "Ask agent",
                    run: openController,
                },
            ]}
        />}
        <div
            className="canvas-surface"
            ref={surface}
            tabIndex={0}
            aria-label="Dashboard surface"
            onKeyDown={event => {

                if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    event.preventDefault();
                    menuOrigin.current = surface.current;
                    const rect = event.currentTarget.getBoundingClientRect();
                    setMenu({
                        x: rect.left + Math.min(rect.width / 2, 160),
                        y: rect.top + Math.min(rect.height / 2, 120),
                    });
                }
            }}
            onContextMenu={event => {

                event.preventDefault();
                menuOrigin.current = surface.current;
                setMenu({
                    x: event.clientX,
                    y: event.clientY,
                });
            }}
            onPointerDown={onSurfaceDown}
            onPointerMove={event => {

                const current = drag.current;
                if (current) {
                    setViewport(value => {

                        return {
                            ...value,
                            x: current.startX + event.clientX - current.x,
                            y: current.startY + event.clientY - current.y,
                        };
                    });
                }
            }}
            onPointerUp={() => {

                drag.current = undefined;
            }}
            onPointerCancel={() => {

                drag.current = undefined;
            }}
            onLostPointerCapture={() => {

                drag.current = undefined;
            }}
        >
            {canvas && <CanvasBlocks
                canvasId={canvasId}
                blocks={canvas.blocks}
                api={blocksApi}
                viewport={viewport}
                interact={interact}
            />}
            <div
                className="dashboard-zoom"
                key={viewport.zoom}
                aria-label="Zoom"
            >
                {Math.round(viewport.zoom * 100)}
                %
            </div>
        </div>
        {error && <div
            className="canvas-error"
            role="alert"
        >
            {error}
        </div>}
    </section>;
};

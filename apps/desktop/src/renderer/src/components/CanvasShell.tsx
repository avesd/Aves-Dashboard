import type { CanvasDocument, CanvasServiceApi } from "../../../shared/canvas/contracts";
import { fitViewport, initialViewport } from "./canvas-geometry";
import { CanvasWorld } from "./CanvasWorld";
import { DashboardMenu } from "./DashboardMenu";
import type { PointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
    readonly api: Pick<CanvasServiceApi, "read" | "subscribe">;
    readonly canvasId: string;
    readonly openController: () => void;
}

export const CanvasShell = ({ api, canvasId, openController }: Props) => {

    const surface = useRef<HTMLDivElement>(null);
    const fitInitialized = useRef(false);
    const [
        canvas,
        setCanvas,
    ] = useState<CanvasDocument>();
    const [
        viewport,
        setViewport,
    ] = useState(initialViewport);
    const [
        selected,
        setSelected,
    ] = useState<string>();
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

        setMenu(undefined); surface.current?.focus({ preventScroll: true });
    }, []);
    useEffect(() => {

        if (selected && canvas && !canvas.items.some(item => {

            return item.id === selected;
        })) {
            setSelected(undefined);
        }
    }, [
        canvas,
        selected,
    ]);

    useEffect(() => {

        let active = true;
        const refresh = () => {

            void api.read(canvasId).then(value => {

                if (active) {
                    setCanvas(previous => {

                        return !previous || value.revision >= previous.revision ? value : previous;
                    }); setError(undefined);
                    if (!fitInitialized.current) {
                        const rect = surface.current?.getBoundingClientRect();
                        if (rect) {
                            setViewport(fitViewport(value.items, rect.width, rect.height));
                        }
                        fitInitialized.current = true;
                    }
                }
            })
                .catch(cause => {

                    if (active) {
                        setError(cause instanceof Error ? cause.message : "Dashboard could not be loaded.");
                    }
                });
        };
        const dispose = api.subscribe(refresh);
        refresh();

        return () => {

            active = false; dispose();
        };
    }, [
        api,
        canvasId,
    ]);

    const fit = useCallback(() => {

        const rect = surface.current?.getBoundingClientRect();
        if (rect && canvas) {
            setViewport(fitViewport(canvas.items, rect.width, rect.height));
        }
    }, [canvas]);
    useEffect(() => {

        const keyDown = (event: KeyboardEvent) => {

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault(); openController();
            } else if ((event.metaKey || event.ctrlKey) && event.key === "0") {
                event.preventDefault(); fit();
            } else if (event.key === "Escape") {
                setSelected(undefined); setMenu(undefined);
            }
        };
        window.addEventListener("keydown", keyDown);

        return () => {

            window.removeEventListener("keydown", keyDown);
        };
    }, [
        fit,
        openController,
    ]);
    useEffect(() => {

        const node = surface.current;
        if (!node) {
            return;
        }
        const wheel = (event: WheelEvent) => {

            if ((event.target as HTMLElement).closest("input, textarea, [contenteditable]")) {
                return;
            }
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

    const onSurfaceDown = (event: PointerEvent<HTMLDivElement>) => {

        if (event.target !== event.currentTarget || event.button !== 0) {
            return;
        }
        event.currentTarget.focus({ preventScroll: true });
        setSelected(undefined);
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
                    label: "Show all",
                    run: fit,
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
            onContextMenu={event => {

                event.preventDefault();
                const card = (event.target as HTMLElement).closest<HTMLElement>("[data-item-id]");
                setSelected(card?.dataset.itemId);
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
            <CanvasWorld
                canvas={canvas}
                viewport={viewport}
                setViewport={setViewport}
                selected={selected}
                setSelected={setSelected}
                surface={surface}
            />
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

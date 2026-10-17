/**
 * @author Avesd
 * @package Renderer Canvas
 * @namespace Root
 * @description Main
 */

import "./styles.css";
import type { CanvasApi } from "./canvas-api";
import { CanvasShell } from "./components/CanvasShell";
import type { DesktopView } from "@avesd/desktop-contracts/canvas/views";
import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import { StrictMode } from "react";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const CanvasView = ({ api }: {
    readonly api: CanvasApi;
}) => {

    const [
        view,
        setView,
    ] = useState<DesktopView>();
    const [
        error,
        setError,
    ] = useState<string>();
    const openController = useCallback(() => {

        void api.views.controller(true).catch((cause) => {

            setError(ipcErrorMessage(cause, "Controller could not be opened."));
        });
    }, [api]);
    useEffect(() => {

        let active = true;
        const refresh = () => {

            void api.views.inspect().then(value => {

                if (active) {
                    if (!value.canvasId) {
                        throw new Error("Canvas loaded outside a canvas window.");
                    }
                    document.documentElement.dataset.surface = "canvas";
                    setView(value);
                }
            })
                .catch((cause) => {

                    if (active) {
                        setError(ipcErrorMessage(cause, "Window could not be initialized."));
                    }
                });
        };
        const dispose = api.views.subscribe(refresh);
        refresh();

        return () => {

            active = false;
            dispose();
        };
    }, [api]);

    return <>
        {view?.canvasId ? <CanvasShell
            key={view.canvasId}
            api={api.canvases}
            blocksApi={api.blocks}
            canvasId={view.canvasId}
            openController={openController}
        /> : null}
        {error && <div
            role="alert"
        >
            {error}
        </div>}
    </>;
};

export function mountCanvas(root: HTMLElement, api: CanvasApi): void {

    createRoot(root).render(<StrictMode>
        <CanvasView
            api={api}
        />
    </StrictMode>);
}

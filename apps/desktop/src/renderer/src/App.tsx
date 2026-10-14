import type { DesktopView } from "../../shared/canvas/views";
import { CanvasShell } from "./components/CanvasShell";
import { Controller } from "./components/Controller";
import { useCallback, useEffect, useState } from "react";

export const App = () => {

    const [
        view,
        setView,
    ] = useState<DesktopView>();
    const [
        error,
        setError,
    ] = useState<string>();
    const openController = useCallback(() => {

        void window.avesd.views.controller(true).catch(() => {

            setError("Controller could not be opened.");
        });
    }, []);
    useEffect(() => {

        let active = true;
        const refresh = () => {

            void window.avesd.views.inspect().then(value => {

                if (active) {
                    document.documentElement.dataset.surface = value.canvasId ? "canvas" : "controller";
                    setView(value);
                }
            })
                .catch(() => {

                    if (active) {
                        setError("Window could not be initialized.");
                    }
                });
        };
        const dispose = window.avesd.views.subscribe(refresh);
        refresh();

        return () => {

            active = false; dispose();
        };
    }, []);

    return <>
        {view?.canvasId ? <CanvasShell
            key={view.canvasId}
            api={window.avesd.canvases}
            canvasId={view.canvasId}
            openController={openController}
        /> : view ? <Controller
            expanded={view.expanded ?? false}
        /> : null}
        {error && <div
            role="alert"
        >
            {error}
        </div>}
    </>;
};

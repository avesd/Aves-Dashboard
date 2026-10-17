/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Root
 * @description Main
 */

import "./styles.css";
import { Controller } from "./components/Controller";
import type { ControllerApi } from "./controller-api";
import { ControllerContext } from "./controller-context";
import { ipcErrorMessage } from "@avesd/desktop-contracts/ipc-result";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function ControllerView({ api }: {
    readonly api: ControllerApi;
}) {

    const [
        expanded,
        setExpanded,
    ] = useState<boolean>();
    const [
        error,
        setError,
    ] = useState<string>();
    useEffect(() => {

        let active = true;
        const refresh = () => {

            void api.views.inspect().then(view => {

                if (!active) {
                    return;
                }
                if (view.canvasId) {
                    throw new Error("Controller loaded in a canvas window.");
                }
                document.documentElement.dataset.surface = "controller";
                setExpanded(view.expanded ?? false);
            })
                .catch((cause) => {

                    if (active) {
                        setError(ipcErrorMessage(cause, "Controller could not be initialized."));
                    }
                });
        };
        const unsubscribe = api.views.subscribe(refresh);
        refresh();

        return () => {

            active = false;
            unsubscribe();
        };
    }, [api]);

    return <ControllerContext.Provider
        value={api}
    >
        {expanded !== undefined && <Controller
            expanded={expanded}
        />}
        {error && <div
            role="alert"
        >
            {error}
        </div>}
    </ControllerContext.Provider>;
}

export function mountController(root: HTMLElement, api: ControllerApi): void {

    createRoot(root).render(<StrictMode>
        <ControllerView
            api={api}
        />
    </StrictMode>);
}

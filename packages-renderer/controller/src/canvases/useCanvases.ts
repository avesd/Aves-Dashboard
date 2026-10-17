/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Canvases
 * @description UseCanvases
 */

import type { ControllerApi } from "../controller-api";
import type { CanvasSummary } from "@avesd/desktop-contracts/canvas/contracts";
import { useEffect, useState } from "react";

export function useCanvases(api: ControllerApi, fail: (cause: unknown) => void) {

    const [
        canvases,
        setCanvases,
    ] = useState<readonly CanvasSummary[]>([]);
    useEffect(() => {

        let active = true;
        let generation = 0;
        const refresh = async () => {

            const current = ++generation;
            try {
                const items: CanvasSummary[] = [];
                let cursor: string | undefined;
                do {
                    const page = await api.canvases.list({
                        limit: 100,
                        ...(cursor ? { cursor } : {}),
                    });
                    items.push(...page.canvases);
                    cursor = page.nextCursor;
                } while (cursor && active && current === generation);
                if (active && current === generation) {
                    setCanvases(items);
                }
            } catch (cause) {
                if (active) {
                    fail(cause);
                }
            }
        };
        const dispose = api.canvases.subscribe(() => {

            void refresh();
        });
        void refresh();

        return () => {

            active = false;
            dispose();
        };
    }, [
        api.canvases,
        fail,
    ]);

    return canvases;
}

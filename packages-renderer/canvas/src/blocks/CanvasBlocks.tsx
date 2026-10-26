/**
 * @author Avesd
 * @package Renderer Canvas
 * @namespace Blocks
 * @description CanvasBlocks
 */

import { createCanvasSandbox } from "./canvas-sandbox";
import type { CanvasSandboxInteraction, CanvasSandboxMount, CanvasViewport, DashboardBlocksApi } from "@avesd/desktop-contracts/canvas/blocks";
import { InlineNotice } from "@avesd/ui-data";
import type { DashboardBlock } from "@avesd/workspace-model";
import { useEffect, useRef, useState } from "react";

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
    ] = useState<string>();
    const controller = useRef<ReturnType<typeof createCanvasSandbox> | undefined>(undefined);

    useEffect(() => {

        const current = createCanvasSandbox({
            api,
            canvasId,
            frame: () => {

                return frame.current;
            },
            view: () => {

                return latest.current;
            },
            sandbox: setSandbox,
            error: setError,
        });
        controller.current = current;

        return () => {

            current.dispose();
            controller.current = undefined;
        };
    }, [
        api,
        canvasId,
    ]);
    useEffect(() => {

        void controller.current?.synchronize();
    }, [blocks]);
    useEffect(() => {

        controller.current?.updateViewport();
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

                controller.current?.connect();
            }}
        />
        {error && <InlineNotice
            className="canvas-error"
            tone="danger"
            announcement="polite"
        >
            {error}
        </InlineNotice>}
    </>;
}

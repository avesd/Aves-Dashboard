/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Canvases
 * @description CanvasesPanel
 */

import { useControllerApi } from "../controller-context";
import type { CanvasSummary } from "@avesd/desktop-contracts/canvas/contracts";
import { Button } from "@avesd/ui-controls";
import { Layers } from "lucide-react";

interface Props {
    readonly canvases: readonly CanvasSummary[];
    readonly fail: (cause: unknown) => void;
}

export function CanvasesPanel({ canvases, fail }: Props) {

    const api = useControllerApi();

    return <section
        className="controller-content"
    >
        <div
            className="controller-section-title"
        >
            <h1>Your dashboards</h1>
        </div>
        {canvases.map(canvas => {

            return <div
                className="controller-canvas"
                key={canvas.id}
            >
                <Button
                    className="flex-1 min-w-0 justify-start min-h-[64px] border-0 rounded-none text-left"
                    variant="quiet"
                    size="small"
                    onClick={() => {

                        void api.views.open(canvas.id).catch(fail);
                    }}
                >
                    <Layers
                        size={17}
                    />
                    <span>
                        {canvas.title}
                    </span>
                </Button>
                <span>
                    r
                    {canvas.revision}
                </span>
            </div>;
        })}
    </section>;
}

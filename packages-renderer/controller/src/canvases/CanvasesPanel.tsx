/**
 * @author Avesd
 * @package Renderer Controller
 * @namespace Canvases
 * @description CanvasesPanel
 */

import { useControllerApi } from "../controller-context";
import type { CanvasSummary } from "@avesd/desktop-contracts/canvas/contracts";
import { CollectionItem, CollectionItemButton } from "@avesd/ui-layout";
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
            <h1>Canvases</h1>
        </div>
        <ul
            className="m-0 list-none p-0"
            aria-label="Canvases"
        >
            {canvases.map(canvas => {

                return <CollectionItem
                    className="px-gridui-16"
                    key={canvas.id}
                >
                    <CollectionItemButton
                        className="min-h-[64px] rounded-none px-gridui-8 py-[12px] type-ui"
                        title={<span
                            className="block truncate"
                        >
                            {canvas.title}
                        </span>}
                        icon={<Layers
                            size={16}
                        />}
                        onClick={() => {

                            void api.views.open(canvas.id).catch(fail);
                        }}
                    />
                </CollectionItem>;
            })}
        </ul>
    </section>;
}

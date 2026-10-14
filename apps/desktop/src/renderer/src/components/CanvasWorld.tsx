import type { Viewport } from "./canvas-geometry";
import type { CanvasState } from "@avesd/workspace-model";
import { Sparkles } from "lucide-react";
import type { Dispatch, RefObject, SetStateAction } from "react";

interface Props {
    readonly canvas?: Pick<CanvasState, "items" | "links">;
    readonly viewport: Viewport;
    readonly setViewport: Dispatch<SetStateAction<Viewport>>;
    readonly selected?: string;
    readonly setSelected: Dispatch<SetStateAction<string | undefined>>;
    readonly surface: RefObject<HTMLDivElement | null>;

}

export const CanvasWorld = ({ canvas, viewport, setViewport, selected, setSelected, surface }: Props) => {

    const byId = new Map(canvas?.items.map(item => {

        return [
            item.id,
            item,
        ];
    }) ?? []);

    return <div
        className="canvas-world"
        style={{ transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})` }}
    >
        <svg
            className="canvas-links"
            aria-hidden="true"
        >
            {canvas?.links.map(link => {

                const from = byId.get(link.from); const to = byId.get(link.to);
                if (!from || !to) {
                    return null;
                }
                const a = from.placement; const b = to.placement;

                return <line
                    key={link.id}
                    x1={a.x + from.placement.width / 2}
                    y1={a.y + from.placement.height / 2}
                    x2={b.x + to.placement.width / 2}
                    y2={b.y + to.placement.height / 2}
                />;
            })}
        </svg>
        {canvas?.items.filter(item => {

            return item.content.kind === "group";
        }).map(item => {

            return <article
                key={item.id}
                data-item-id={item.id}
                className={`canvas-item canvas-group${selected === item.id ? " is-selected" : ""}`}
                style={{
                    width: item.placement.width,
                    height: item.placement.height,
                    transform: `translate3d(${item.placement.x}px, ${item.placement.y}px, 0)`,
                }}
                onPointerDown={event => {

                    event.stopPropagation();
                    if (event.button === 0) {
                        setSelected(item.id);
                    }
                }}
            >
                <span
                    className="canvas-group-title"
                >
                    {item.content.text}
                </span>
            </article>;
        })}
        {canvas?.items.filter(item => {

            return item.content.kind !== "group";
        }).map(item => {

            return <article
                key={item.id}
                data-item-id={item.id}
                className={`canvas-item canvas-card canvas-card-${item.content.kind}${selected === item.id ? " is-selected" : ""}`}
                style={{
                    width: item.placement.width,
                    height: item.placement.height,
                    transform: `translate3d(${item.placement.x}px, ${item.placement.y}px, 0)`,
                }}
                onPointerDown={event => {

                    event.stopPropagation();
                    if (event.button === 0) {
                        setSelected(item.id);
                    }
                }}

            >
                <span
                    className="canvas-card-mark"
                >
                    <Sparkles
                        size={14}
                    />
                    <span>
                        {item.content.kind === "idea" ? "Idea" : item.content.kind === "source" ? "Source" : "Conclusion"}
                    </span>
                </span>
                <p>
                    {item.content.text}
                </p>
                {item.content.kind === "source" && item.content.excerpt && <span
                    className="canvas-source-excerpt"
                >
                    {item.content.excerpt}
                </span>}
                {item.content.kind === "source" && <span
                    className="canvas-source-url"
                >
                    {item.content.url}
                </span>}
                {item.content.kind === "result" && <div
                    className="canvas-evidence"
                >
                    <strong>Based on</strong>
                    {item.content.evidence.map(entry => {

                        const target = byId.get(entry.itemId);

                        return <button
                            key={entry.itemId}
                            type="button"
                            title={[
                                entry.label,
                                entry.url,
                                entry.excerpt,
                            ].filter(Boolean).join("\n")}
                            onPointerDown={event => {

                                return void event.stopPropagation();
                            }}
                            onClick={() => {

                                if (target) {
                                    setSelected(target.id);
                                    const rect = surface.current?.getBoundingClientRect();
                                    if (rect) {
                                        setViewport({
                                            ...viewport,
                                            x: rect.width / 2 - (target.placement.x + target.placement.width / 2) * viewport.zoom,
                                            y: rect.height / 2 - (target.placement.y + target.placement.height / 2) * viewport.zoom,
                                        });
                                    }
                                }
                            }}
                        >
                            {entry.label}
                            {target ? "" : " (removed)"}
                        </button>;
                    })}
                </div>}
            </article>;
        })}
    </div>;
};

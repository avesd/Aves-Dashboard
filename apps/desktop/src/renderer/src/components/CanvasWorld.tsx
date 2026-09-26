import type { Viewport } from "./canvas-geometry";
import type { CanvasItem, CanvasOperation, CanvasState } from "@avesd/workspace-model";
import { Sparkles } from "lucide-react";
import type { Dispatch, PointerEvent, RefObject, SetStateAction } from "react";
import { useState } from "react";

interface Props {
    readonly canvas?: CanvasState;
    readonly viewport: Viewport;
    readonly setViewport: Dispatch<SetStateAction<Viewport>>;
    readonly preview: Record<string, {
        x: number;
        y: number;
    }>;
    readonly selected?: string;
    readonly setSelected: Dispatch<SetStateAction<string | undefined>>;
    readonly surface: RefObject<HTMLDivElement | null>;
    readonly apply: (operations: readonly CanvasOperation[]) => Promise<void>;
    readonly setError: Dispatch<SetStateAction<string | undefined>>;
    readonly onItemDown: (event: PointerEvent<HTMLElement>, item: CanvasItem) => void;
    readonly onDragMove: (event: PointerEvent<HTMLElement>) => void;
    readonly onDragEnd: (event: PointerEvent<HTMLElement>) => void;
}

export const CanvasWorld = ({ canvas, viewport, setViewport, preview, selected, setSelected, surface, apply, setError, onItemDown, onDragMove, onDragEnd }: Props) => {

    const [
        editing,
        setEditing,
    ] = useState<{
        id: string;
        text: string;
        url?: string;
        excerpt?: string;
    }>();
    const byId = new Map(canvas?.items.map(item => {

        return [
            item.id,
            item,
        ];
    }) ?? []);
    const itemPosition = (item: CanvasItem) => {

        const own = preview[item.id];
        if (own) {
            return own;
        }
        const parent = item.groupId ? byId.get(item.groupId) : undefined;
        const position = parent ? preview[parent.id] : undefined;
        if (parent && position) {
            return {
                x: item.placement.x + position.x - parent.placement.x,
                y: item.placement.y + position.y - parent.placement.y,
            };
        }

        return item.placement;
    };

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
                const a = itemPosition(from); const b = itemPosition(to);

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
                className={`canvas-item canvas-group${selected === item.id ? " is-selected" : ""}${preview[item.id] ? " is-dragging" : ""}`}
                style={{
                    width: item.placement.width,
                    height: item.placement.height,
                    transform: `translate3d(${itemPosition(item).x}px, ${itemPosition(item).y}px, 0)`,
                }}
                onPointerDown={event => {

                    return void onItemDown(event, item);
                }}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
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
                className={`canvas-item canvas-card canvas-card-${item.content.kind}${selected === item.id ? " is-selected" : ""}${preview[item.id] ? " is-dragging" : ""}`}
                style={{
                    width: item.placement.width,
                    height: item.placement.height,
                    transform: `translate3d(${itemPosition(item).x}px, ${itemPosition(item).y}px, 0)`,
                }}
                onPointerDown={event => {

                    return void onItemDown(event, item);
                }}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onDoubleClick={() => {

                    setEditing({
                        id: item.id,
                        text: item.content.text,
                        ...(item.content.kind === "source" ? {
                            url: item.content.url,
                            excerpt: item.content.excerpt ?? "",
                        } : {}),
                    });
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
                {editing?.id === item.id ? <form
                    className="canvas-card-editor"
                    onPointerDown={event => {

                        event.stopPropagation();
                    }}
                    onSubmit={event => {

                        event.preventDefault();
                        const text = editing.text.trim();
                        if (!text) {
                            return;
                        }
                        if (item.content.kind === "source") {
                            const url = editing.url?.trim() ?? "";
                            if (!url) {
                                return;
                            }
                            try {
                                const address = new URL(url);
                                if ((address.protocol !== "http:" && address.protocol !== "https:") || address.username || address.password) {
                                    throw new Error("Unsupported protocol.");
                                }
                            } catch {
                                setError("Enter an HTTP or HTTPS source URL without credentials.");

                                return;
                            }
                            void apply([
                                {
                                    type: "updateContent",
                                    id: item.id,
                                    content: {
                                        ...item.content,
                                        text,
                                        url,
                                        excerpt: editing.excerpt?.trim() || undefined,
                                    },
                                },
                            ]);
                        } else if (text !== item.content.text) {
                            void apply([
                                {
                                    type: "update",
                                    id: item.id,
                                    text,
                                },
                            ]);
                        }
                        setEditing(undefined);
                    }}
                >
                    <textarea
                        autoFocus
                        value={editing.text}
                        aria-label="Edit card text"
                        maxLength={8_000}
                        onChange={event => {

                            setEditing({
                                ...editing,
                                text: event.target.value,
                            });
                        }}
                    />
                    {item.content.kind === "source" && <input
                        type="url"
                        value={editing.url ?? ""}
                        aria-label="Edit source URL"
                        maxLength={2_048}
                        onChange={event => {

                            setEditing({
                                ...editing,
                                url: event.target.value,
                            });
                        }}
                    />}
                    {item.content.kind === "source" && <textarea
                        className="canvas-excerpt-editor"
                        value={editing.excerpt ?? ""}
                        aria-label="Edit source excerpt"
                        maxLength={4_000}
                        onChange={event => {

                            setEditing({
                                ...editing,
                                excerpt: event.target.value,
                            });
                        }}
                    />}
                    <div>
                        <button
                            type="button"
                            onClick={() => {

                                return void setEditing(undefined);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                        >
                            Save
                        </button>
                    </div>
                </form> : <>
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
                </>}
            </article>;
        })}
    </div>;
};

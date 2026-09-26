import type { AgentSessionsApi } from "../../../shared/agent/sessions";
import type { CanvasApi } from "../../../shared/workspace/canvas";
import type { Viewport } from "./canvas-geometry";
import { fitViewport, initialViewport, placeCanvasItem } from "./canvas-geometry";
import type { CanvasContent, CanvasItem, CanvasOperation, CanvasState, DashboardScope } from "@avesd/workspace-model";
import { ArrowRight, Frame, Link2, Maximize2, Plus, RotateCcw, Sparkles, SquareArrowOutUpRight } from "lucide-react";
import type { PointerEvent, SyntheticEvent, WheelEvent } from "react";
import { useEffect, useRef, useState } from "react";

interface Props {
    readonly api: CanvasApi;
    readonly agent: AgentSessionsApi;
    readonly scope: DashboardScope;
}

export const CanvasShell = ({ api, agent, scope }: Props) => {

    const surface = useRef<HTMLDivElement>(null);
    const fitInitialized = useRef(false);
    const commandInput = useRef<HTMLInputElement>(null);
    const writeQueue = useRef<Promise<void>>(Promise.resolve());
    const drag = useRef<{
        id?: string;
        x: number;
        y: number;
        startX: number;
        startY: number;
        viewport: Viewport;
    } | undefined>(undefined);
    const [
        canvas,
        setCanvas,
    ] = useState<CanvasState>();
    const [
        viewport,
        setViewport,
    ] = useState(initialViewport);
    const [
        selected,
        setSelected,
    ] = useState<string>();
    const [
        editing,
        setEditing,
    ] = useState<{
        id: string;
        text: string;
        url?: string;
        excerpt?: string;
    }>();
    const [
        sourceDraft,
        setSourceDraft,
    ] = useState<{
        text: string;
        url: string;
        excerpt: string;
    }>();
    const [
        draft,
        setDraft,
    ] = useState("");
    const [
        busy,
        setBusy,
    ] = useState(false);
    const [
        error,
        setError,
    ] = useState<string>();
    const [
        preview,
        setPreview,
    ] = useState<Record<string, {
        x: number;
        y: number;
    }>>({});

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

            void api.inspect(scope).then(value => {

                if (active) {
                    setCanvas(value); setError(undefined);
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
                        setError(cause instanceof Error ? cause.message : "Canvas could not be loaded.");
                    }
                });
        };
        refresh();
        const dispose = api.subscribe(refresh);

        return () => {

            active = false; dispose();
        };
    }, [
        api,
        scope.dashboardId,
        scope.workspaceId,
    ]);

    const apply = (operations: readonly CanvasOperation[]): Promise<void> => {

        const write = writeQueue.current.then(async () => {

            try {
                const current = await api.inspect(scope);
                const next = await api.apply(scope, {
                    expectedRevision: current.revision,
                    operations,
                });
                setCanvas(next);
                setError(undefined);
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Canvas could not be changed.");
                setCanvas(await api.inspect(scope));
            }
        });
        writeQueue.current = write.catch(() => {

            return undefined;
        });

        return write;
    };

    const add = (content: CanvasContent) => {

        const rect = surface.current?.getBoundingClientRect();
        const existing = canvas?.items ?? [];
        const { position, width, height, shouldFit } = placeCanvasItem(content, existing, viewport, rect);
        const item: CanvasItem = {
            id: crypto.randomUUID(),
            content,
            placement: {
                ...position,
                width,
                height,
            },
        };
        void apply([
            {
                type: "add",
                item,
            },
        ]);
        if (rect && shouldFit) {
            setViewport(fitViewport([
                ...existing,
                item,
            ], rect.width, rect.height));
        }
        setSelected(item.id);
    };

    useEffect(() => {

        const keyDown = (event: KeyboardEvent) => {

            const target = event.target as HTMLElement;
            const editing = target.closest("input, textarea, [contenteditable]");
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault(); commandInput.current?.focus();
            } else if (!editing && (event.key === "Delete" || event.key === "Backspace") && selected) {
                event.preventDefault(); void apply([
                    {
                        type: "remove",
                        id: selected,
                    },
                ]); setSelected(undefined);
            } else if (!editing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
                event.preventDefault(); void apply([{ type: "undo" }]);
            } else if (event.key === "Escape") {
                setSelected(undefined); commandInput.current?.blur();
            }
        };
        window.addEventListener("keydown", keyDown);

        return () => {

            window.removeEventListener("keydown", keyDown);
        };
    }, [
        canvas,
        selected,
    ]);

    const submit = async (event: SyntheticEvent<HTMLFormElement>) => {

        event.preventDefault();
        const text = draft.trim();
        if (!text || busy) {
            return;
        }
        setBusy(true); setError(undefined);
        try {
            const listing = await agent.list();
            const active = listing.sessions.find(value => {

                return value.id === listing.selectedId
                && value.workspaceId === scope.workspaceId && value.dashboardId === scope.dashboardId
                && value.status !== "stopped";
            });
            const id = active?.id ?? (await agent.create("flagship")).id;
            setDraft("");
            await agent.prompt(id, text);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "The agent could not respond.");
        } finally { setBusy(false); }
    };

    const onWheel = (event: WheelEvent<HTMLDivElement>) => {

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.ctrlKey || event.metaKey) {
            const zoom = Math.max(0.2, Math.min(3, viewport.zoom * Math.exp(-event.deltaY * 0.003)));
            const x = event.clientX - rect.left; const y = event.clientY - rect.top;
            setViewport({
                x: x - (x - viewport.x) * zoom / viewport.zoom,
                y: y - (y - viewport.y) * zoom / viewport.zoom,
                zoom,
            });
        } else {
            setViewport(value => {

                return {
                    ...value,
                    x: value.x - event.deltaX,
                    y: value.y - event.deltaY,
                };
            });
        }
    };

    const onSurfaceDown = (event: PointerEvent<HTMLDivElement>) => {

        if (event.target !== event.currentTarget) {
            return;
        }
        setSelected(undefined);
        drag.current = {
            x: event.clientX,
            y: event.clientY,
            startX: viewport.x,
            startY: viewport.y,
            viewport,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onItemDown = (event: PointerEvent<HTMLElement>, item: CanvasItem) => {

        event.stopPropagation();
        if (event.shiftKey && selected && selected !== item.id) {
            const source = canvas?.items.find(value => {

                return value.id === selected;
            });
            if (source && source.content.kind !== "group" && item.content.kind === "group") {
                void apply([
                    {
                        type: "group",
                        id: source.id,
                        groupId: item.id,
                    },
                ]);
            } else if (source?.content.kind === "result" && item.content.kind !== "group") {
                if (source.content.evidence.some(entry => {

                    return entry.itemId === item.id;
                })) {
                    return;
                }
                void apply([
                    {
                        type: "updateContent",
                        id: source.id,
                        content: {
                            ...source.content,
                            evidence: [
                                ...source.content.evidence,
                                {
                                    itemId: item.id,
                                    label: item.content.text.slice(0, 200),
                                    ...(item.content.kind === "source" ? {
                                        url: item.content.url,
                                        ...(item.content.excerpt ? { excerpt: item.content.excerpt } : {}),
                                    } : {}),
                                },
                            ],
                        },
                    },
                    {
                        type: "link",
                        link: {
                            id: crypto.randomUUID(),
                            from: selected,
                            to: item.id,
                        },
                    },
                ]);
            } else {
                void apply([
                    {
                        type: "link",
                        link: {
                            id: crypto.randomUUID(),
                            from: selected,
                            to: item.id,
                        },
                    },
                ]);
            }

            return;
        }
        setSelected(item.id);
        drag.current = {
            id: item.id,
            x: event.clientX,
            y: event.clientY,
            startX: item.placement.x,
            startY: item.placement.y,
            viewport,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const onDragMove = (event: PointerEvent<HTMLElement>) => {

        const current = drag.current;
        if (!current) {
            return;
        }
        const dx = event.clientX - current.x; const dy = event.clientY - current.y;
        if (current.id) {
            setPreview({
                [current.id]: {
                    x: current.startX + dx / current.viewport.zoom,
                    y: current.startY + dy / current.viewport.zoom,
                },
            });
        } else {
            setViewport(value => {

                return {
                    ...value,
                    x: current.startX + dx,
                    y: current.startY + dy,
                };
            });
        }
    };

    const onDragEnd = (event: PointerEvent<HTMLElement>) => {

        const current = drag.current;
        drag.current = undefined;
        if (!current?.id) {
            return;
        }
        const x = Math.round(current.startX + (event.clientX - current.x) / current.viewport.zoom);
        const y = Math.round(current.startY + (event.clientY - current.y) / current.viewport.zoom);
        if (x !== current.startX || y !== current.startY) {
            setPreview({
                [current.id]: {
                    x,
                    y,
                },
            });
            void apply([
                {
                    type: "move",
                    id: current.id,
                    x,
                    y,
                },
            ]).finally(() => {

                setPreview({});
            });
        } else {
            setPreview({});
        }
    };

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

    return <section
        className="canvas-shell"
        aria-label="Spatial canvas"
    >
        <div
            className="canvas-topbar"
        >
            <div>
                <span
                    className="canvas-eyebrow"
                >
                    AVESD / CANVAS
                </span>
                <h1>Think in space.</h1>
            </div>
            <div
                className="canvas-actions"
            >
                <button
                    type="button"
                    onClick={() => {

                        return void add({
                            kind: "idea",
                            version: 1,
                            text: "New thought",
                        });
                    }}
                >
                    <Plus
                        size={16}
                    />
                    {" "}
                    Idea
                </button>
                <button
                    type="button"
                    onClick={() => {

                        setSourceDraft({
                            text: "",
                            url: "",
                            excerpt: "",
                        });
                    }}
                >
                    <SquareArrowOutUpRight
                        size={15}
                    />
                    {" "}
                    Source
                </button>
                <button
                    type="button"
                    disabled={!selected || !canvas?.items.some(item => {

                        return item.id === selected && item.content.kind !== "group";
                    })}
                    onClick={() => {

                        const evidence = canvas?.items.find(item => {

                            return item.id === selected;
                        });
                        if (evidence && evidence.content.kind !== "group") {
                            add({
                                kind: "result",
                                version: 1,
                                text: "New conclusion",
                                evidence: [
                                    {
                                        itemId: evidence.id,
                                        label: evidence.content.text.slice(0, 200),
                                        ...(evidence.content.kind === "source" ? {
                                            url: evidence.content.url,
                                            ...(evidence.content.excerpt ? { excerpt: evidence.content.excerpt } : {}),
                                        } : {}),
                                    },
                                ],
                            });
                        }
                    }}
                >
                    <Sparkles
                        size={15}
                    />
                    {" "}
                    Conclusion
                </button>
                <button
                    type="button"
                    onClick={() => {

                        return void add({
                            kind: "group",
                            version: 1,
                            text: "New group",
                        });
                    }}
                >
                    <Frame
                        size={16}
                    />
                    {" "}
                    Group
                </button>
                <button
                    type="button"
                    disabled={!canvas?.history.length}
                    onClick={() => {

                        void apply([{ type: "undo" }]);
                    }}
                >
                    <RotateCcw
                        size={16}
                    />
                    {" "}
                    Undo
                </button>
                <button
                    type="button"
                    title="Fit canvas"
                    onClick={() => {

                        const rect = surface.current?.getBoundingClientRect();
                        if (rect && canvas) {
                            setViewport(fitViewport(canvas.items, rect.width, rect.height));
                        }
                    }}
                >
                    <Maximize2
                        size={16}
                    />
                    {" "}
                    Fit
                </button>
            </div>
        </div>
        {sourceDraft && <form
            className="canvas-source-form"
            aria-label="Add source"
            onSubmit={event => {

                event.preventDefault();
                const text = sourceDraft.text.trim();
                const url = sourceDraft.url.trim();
                if (text && url) {
                    try {
                        const address = new URL(url);
                        if ((address.protocol !== "http:" && address.protocol !== "https:") || address.username || address.password) {
                            throw new Error("Unsupported protocol.");
                        }
                    } catch {
                        setError("Enter an HTTP or HTTPS source URL without credentials.");

                        return;
                    }
                    add({
                        kind: "source",
                        version: 1,
                        text,
                        url,
                        ...(sourceDraft.excerpt.trim() ? { excerpt: sourceDraft.excerpt.trim() } : {}),
                    });
                    setSourceDraft(undefined);
                }
            }}
        >
            <strong>Add source</strong>
            <input
                autoFocus
                aria-label="Source title"
                placeholder="Title"
                maxLength={8_000}
                value={sourceDraft.text}
                onChange={event => {

                    setSourceDraft({
                        ...sourceDraft,
                        text: event.target.value,
                    });
                }}
            />
            <input
                type="url"
                aria-label="Source URL"
                placeholder="https://…"
                maxLength={2_048}
                value={sourceDraft.url}
                onChange={event => {

                    setSourceDraft({
                        ...sourceDraft,
                        url: event.target.value,
                    });
                }}
            />
            <textarea
                aria-label="Source excerpt"
                placeholder="Optional excerpt or note"
                maxLength={4_000}
                value={sourceDraft.excerpt}
                onChange={event => {

                    setSourceDraft({
                        ...sourceDraft,
                        excerpt: event.target.value,
                    });
                }}
            />
            <div>
                <button
                    type="button"
                    onClick={() => {

                        setSourceDraft(undefined);
                    }}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!sourceDraft.text.trim() || !sourceDraft.url.trim()}
                >
                    Add
                </button>
            </div>
        </form>}
        <div
            className="canvas-surface"
            ref={surface}
            onWheel={onWheel}
            onPointerDown={onSurfaceDown}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
        >
            <div
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
            </div>
            {!canvas?.items.length && !sourceDraft && <div
                className="canvas-empty"
            >
                <Sparkles
                    size={26}
                />
                <strong>A space for your thoughts.</strong>
                <span>Add an idea or source, or tell the agent what to create.</span>
            </div>}
            <div
                className="canvas-zoom"
            >
                {Math.round(viewport.zoom * 100)}
                %
            </div>
        </div>
        <form
            className="canvas-composer"
            onSubmit={event => {

                void submit(event);
            }}
        >
            <span
                className="canvas-composer-icon"
            >
                <Sparkles
                    size={18}
                />
            </span>
            <input
                ref={commandInput}
                value={draft}
                onChange={event => {

                    return void setDraft(event.target.value);
                }}
                placeholder="Ask the agent to build, organize, or connect ideas…"
                aria-label="Canvas instruction"
            />
            <kbd>⌘ K</kbd>
            <button
                type="submit"
                disabled={!draft.trim() || busy}
                aria-label="Send instruction"
            >
                {busy ? <span
                    className="canvas-spinner"
                /> : <ArrowRight
                    size={18}
                />}
            </button>
        </form>
        {selected && <div
            className="canvas-selection-hint"
        >
            <Link2
                size={14}
            />
            {" "}
            Drag to move · Shift-click to connect or group · Delete to remove
        </div>}
        {error && <div
            className="canvas-error"
            role="alert"
        >
            {error}
        </div>}
    </section>;
};

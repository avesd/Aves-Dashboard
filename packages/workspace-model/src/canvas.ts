/** Persistent, runtime-neutral operations for a dashboard's spatial canvas. */

import type { Dashboard, JsonObject } from "./workspace-model";

export interface CanvasPlacement {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface CanvasEvidence {
    readonly itemId: string;
    readonly label: string;
    readonly url?: string;
    readonly excerpt?: string;
}

export type CanvasContent =
    | {
        readonly kind: "idea" | "group";
        readonly version: 1;
        readonly text: string;
    }
    | {
        readonly kind: "source";
        readonly version: 1;
        readonly text: string;
        readonly url: string;
        readonly excerpt?: string;
    }
    | {
        readonly kind: "result";
        readonly version: 1;
        readonly text: string;
        readonly evidence: readonly CanvasEvidence[];
    };

export interface CanvasItem {
    readonly id: string;
    readonly content: CanvasContent;
    readonly placement: CanvasPlacement;
    readonly groupId?: string;
}

export interface CanvasLink {
    readonly id: string;
    readonly from: string;
    readonly to: string;
}

interface CanvasFrame {
    readonly items: readonly CanvasItem[];
    readonly links: readonly CanvasLink[];
}

export interface CanvasState extends CanvasFrame {
    readonly schemaVersion: 2;
    readonly revision: number;
    readonly history: readonly CanvasFrame[];
}

export type CanvasOperation =
    | {
        readonly type: "add";
        readonly item: CanvasItem;
    }
    | {
        readonly type: "move";
        readonly id: string;
        readonly x: number;
        readonly y: number;
    }
    | {
        readonly type: "resize";
        readonly id: string;
        readonly width: number;
        readonly height: number;
    }
    | {
        readonly type: "update";
        readonly id: string;
        readonly text: string;
    }
    | {
        readonly type: "updateContent";
        readonly id: string;
        readonly content: CanvasContent;
    }
    | {
        readonly type: "group";
        readonly id: string;
        readonly groupId?: string;
    }
    | {
        readonly type: "link";
        readonly link: CanvasLink;
    }
    | {
        readonly type: "remove";
        readonly id: string;
    }
    | {
        readonly type: "undo";
    };

export interface CanvasCommand {
    readonly expectedRevision: number;
    readonly operations: readonly CanvasOperation[];
}

const emptyState: CanvasState = {
    schemaVersion: 2,
    revision: 0,
    items: [],
    links: [],
    history: [],
};

function number(value: unknown, minimum: number, maximum: number): number {

    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
        throw new Error("Invalid canvas number.");
    }

    return value;
}

function string(value: unknown, maximum: number): string {

    if (typeof value !== "string" || !value.trim() || value.length > maximum) {
        throw new Error("Invalid canvas text.");
    }

    return value;
}

function object(value: unknown): Record<string, unknown> {

    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Invalid canvas object.");
    }

    return value as Record<string, unknown>;
}

function placement(value: unknown): CanvasPlacement {

    const data = object(value);

    return {
        x: number(data.x, -1_000_000, 1_000_000),
        y: number(data.y, -1_000_000, 1_000_000),
        width: number(data.width, 80, 4_000),
        height: number(data.height, 60, 4_000),
    };
}

function url(value: unknown): string {

    const address = string(value, 2_048);
    try {
        const parsed = new URL(address);
        if ((parsed.protocol === "https:" || parsed.protocol === "http:") && !parsed.username && !parsed.password) {
            return address;
        }
    } catch {
        // Reject malformed addresses below.
    }
    throw new Error("Canvas sources need an HTTP or HTTPS URL.");
}

function content(value: unknown): CanvasContent {

    const data = object(value);
    if (data.version !== 1) {
        throw new Error("Unsupported canvas content version.");
    }
    const text = string(data.text, 8_000);
    switch (data.kind) {
        case "idea":
        case "group": return {
            kind: data.kind,
            version: 1,
            text,
        };
        case "source": return {
            kind: "source",
            version: 1,
            text,
            url: url(data.url),
            ...(data.excerpt === undefined ? {} : { excerpt: string(data.excerpt, 4_000) }),
        };
        case "result": {
            if (!Array.isArray(data.evidence) || data.evidence.length > 24) {
                throw new Error("Invalid canvas evidence.");
            }
            const evidence = data.evidence.map(raw => {

                const entry = object(raw);

                return {
                    itemId: string(entry.itemId, 128),
                    label: string(entry.label, 200),
                    ...(entry.url === undefined ? {} : { url: url(entry.url) }),
                    ...(entry.excerpt === undefined ? {} : { excerpt: string(entry.excerpt, 4_000) }),
                };
            });
            if (new Set(evidence.map(entry => {

                return entry.itemId;
            })).size !== evidence.length) {
                throw new Error("Duplicate canvas evidence.");
            }

            return {
                kind: "result",
                version: 1,
                text,
                evidence,
            };
        }
        default: throw new Error("Invalid canvas content kind.");
    }
}

function item(value: unknown): CanvasItem {

    const data = object(value);
    const legacy = data.content === undefined;
    const parsedContent = legacy
        ? content({
            kind: data.kind === "card" ? "idea" : data.kind,
            version: 1,
            text: data.text,
        })
        : content(data.content);

    return {
        id: string(data.id, 128),
        content: parsedContent,
        placement: placement(legacy ? data : data.placement),
        ...(data.groupId === undefined ? {} : { groupId: string(data.groupId, 128) }),
    };
}

function link(value: unknown): CanvasLink {

    const data = object(value);

    return {
        id: string(data.id, 128),
        from: string(data.from, 128),
        to: string(data.to, 128),
    };
}

function frame(value: unknown): CanvasFrame {

    const data = object(value);
    if (!Array.isArray(data.items) || !Array.isArray(data.links) || data.items.length > 2_000 || data.links.length > 4_000) {
        throw new Error("Invalid canvas frame.");
    }
    const items = data.items.map(item);
    const links = data.links.map(link);
    const ids = new Set(items.map(value => {

        return value.id;
    }));
    if (ids.size !== items.length || new Set(links.map(value => {

        return value.id;
    })).size !== links.length
        || items.some(value => {

            return value.groupId && (value.content.kind === "group" || !ids.has(value.groupId) || items.find(other => {

                return other.id === value.groupId;
            })?.content.kind !== "group");
        })
        || links.some(value => {

            return !ids.has(value.from) || !ids.has(value.to) || value.from === value.to;
        })) {
        throw new Error("Invalid canvas references.");
    }

    return {
        items,
        links,
    };
}

export function readCanvas(dashboard: Dashboard): CanvasState {

    const raw = dashboard.viewState.canvas;
    if (raw === undefined) {
        return emptyState;
    }
    const data = object(raw);
    if (data.schemaVersion !== undefined && data.schemaVersion !== 2) {
        throw new Error("Unsupported canvas schema version.");
    }
    const current = frame(data);
    if (!Array.isArray(data.history) || data.history.length > 30) {
        throw new Error("Invalid canvas history.");
    }

    return {
        ...current,
        schemaVersion: 2,
        revision: number(data.revision, 0, Number.MAX_SAFE_INTEGER),
        history: data.history.map(frame),
    };
}

export function parseCanvasCommand(input: unknown): CanvasCommand {

    const data = object(input);
    if (!Array.isArray(data.operations) || data.operations.length < 1 || data.operations.length > 50) {
        throw new Error("Canvas command needs 1 to 50 operations.");
    }
    const operations: CanvasOperation[] = data.operations.map(raw => {

        const value = object(raw);
        switch (value.type) {
            case "add": return {
                type: "add",
                item: item(value.item),
            };
            case "move": return {
                type: "move",
                id: string(value.id, 128),
                x: number(value.x, -1_000_000, 1_000_000),
                y: number(value.y, -1_000_000, 1_000_000),
            };
            case "resize": return {
                type: "resize",
                id: string(value.id, 128),
                width: number(value.width, 80, 4_000),
                height: number(value.height, 60, 4_000),
            };
            case "update": return {
                type: "update",
                id: string(value.id, 128),
                text: string(value.text, 8_000),
            };
            case "updateContent": return {
                type: "updateContent",
                id: string(value.id, 128),
                content: content(value.content),
            };
            case "group": return {
                type: "group",
                id: string(value.id, 128),
                ...(value.groupId === undefined ? {} : { groupId: string(value.groupId, 128) }),
            };
            case "link": return {
                type: "link",
                link: link(value.link),
            };
            case "remove": return {
                type: "remove",
                id: string(value.id, 128),
            };
            case "undo": return { type: "undo" };
            default: throw new Error("Unknown canvas operation.");
        }
    });

    return {
        expectedRevision: number(data.expectedRevision, 0, Number.MAX_SAFE_INTEGER),
        operations,
    };
}

export function applyCanvas(state: CanvasState, command: CanvasCommand): CanvasState {

    if (state.revision !== command.expectedRevision) {
        throw new Error("Canvas changed; refresh and retry.");
    }
    let current: CanvasFrame = {
        items: state.items,
        links: state.links,
    };
    let history = [...state.history];
    if (command.operations.some(operation => {

        return operation.type === "undo";
    })) {
        if (command.operations.length !== 1) {
            throw new Error("Undo must be a separate canvas command.");
        }
    } else {
        history = [
            ...history,
            current,
        ].slice(-30);
    }
    for (const operation of command.operations) {
        if (operation.type === "undo") {
            const previous = history.pop();
            if (!previous) {
                throw new Error("Nothing to undo.");
            }
            current = previous;
            continue;
        }
        switch (operation.type) {
            case "add": {
                if (operation.item.content.kind === "result" && operation.item.content.evidence.some(entry => {

                    return !current.items.some(value => {

                        return value.id === entry.itemId && value.content.kind !== "group";
                    });
                })) {
                    throw new Error("Result evidence must refer to existing cards.");
                }
                current = {
                    ...current,
                    items: [
                        ...current.items,
                        operation.item,
                    ],
                }; break;
            }
            case "move": {
                const target = current.items.find(value => {

                    return value.id === operation.id;
                });
                if (!target) {
                    throw new Error("Canvas item was not found.");
                }
                const dx = operation.x - target.placement.x; const dy = operation.y - target.placement.y;
                current = {
                    ...current,
                    items: current.items.map(value => {

                        return value.id === operation.id || (target.content.kind === "group" && value.groupId === target.id)
                            ? {
                                ...value,
                                placement: {
                                    ...value.placement,
                                    x: value.placement.x + dx,
                                    y: value.placement.y + dy,
                                },
                            } : value;
                    }),
                };
                break;
            }
            case "resize":
            case "update":
            case "updateContent":
            case "group": {
                if (!current.items.some(value => {

                    return value.id === operation.id;
                })) {
                    throw new Error("Canvas item was not found.");
                }
                current = {
                    ...current,
                    items: current.items.map(value => {

                        if (value.id !== operation.id) {
                            return value;
                        }
                        if (operation.type === "resize") {
                            return {
                                ...value,
                                placement: {
                                    ...value.placement,
                                    width: operation.width,
                                    height: operation.height,
                                },
                            };
                        }
                        if (operation.type === "update") {
                            return {
                                ...value,
                                content: {
                                    ...value.content,
                                    text: operation.text,
                                },
                            };
                        }
                        if (operation.type === "updateContent") {
                            if (value.content.kind !== operation.content.kind) {
                                throw new Error("Changing a canvas content kind requires a new item.");
                            }
                            if (operation.content.kind === "result" && operation.content.evidence.some(entry => {

                                return !(value.content.kind === "result" && value.content.evidence.some(previous => {

                                    return previous.itemId === entry.itemId;
                                })) && !current.items.some(candidate => {

                                    return candidate.id === entry.itemId && candidate.content.kind !== "group";
                                });
                            })) {
                                throw new Error("Result evidence must refer to existing cards.");
                            }

                            return {
                                ...value,
                                content: operation.content,
                            };
                        }

                        return {
                            ...value,
                            groupId: operation.groupId,
                        };
                    }),
                };
                break;
            }
            case "link": current = {
                ...current,
                links: [
                    ...current.links,
                    operation.link,
                ],
            }; break;
            case "remove": {
                if (!current.items.some(value => {

                    return value.id === operation.id;
                }) && !current.links.some(value => {

                    return value.id === operation.id;
                })) {
                    throw new Error("Canvas item was not found.");
                }
                const removedIds = new Set(current.items.filter(value => {

                    return value.id === operation.id || value.groupId === operation.id;
                }).map(value => {

                    return value.id;
                }));
                current = {
                    items: current.items.filter(value => {

                        return !removedIds.has(value.id);
                    }),
                    links: current.links.filter(value => {

                        return value.id !== operation.id && !removedIds.has(value.from) && !removedIds.has(value.to);
                    }),
                };
                break;
            }
        }
        current = frame(current);
    }

    return {
        ...current,
        schemaVersion: 2,
        revision: state.revision + 1,
        history,
    };
}

export function writeCanvasViewState(dashboard: Dashboard, canvas: CanvasState): JsonObject {

    return {
        ...dashboard.viewState,
        canvas: canvas as unknown as JsonObject,
    };
}

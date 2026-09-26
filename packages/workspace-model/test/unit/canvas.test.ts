import { applyCanvas, parseCanvasCommand, readCanvas, writeCanvasViewState } from "../../src/canvas";
import type { Dashboard } from "../../src/workspace-model";
import { describe, expect, it } from "vitest";

const dashboard: Dashboard = {
    id: "dashboard" as Dashboard["id"],
    workspaceId: "workspace" as Dashboard["workspaceId"],
    name: "Canvas",
    layoutRevision: 0,
    viewState: {},
};

describe("canvas operations", () => {

    it("moves grouped cards, preserves the view state, and undoes the move", () => {

        const initial = readCanvas(dashboard);
        const added = applyCanvas(initial, parseCanvasCommand({
            expectedRevision: 0,
            operations: [
                {
                    type: "add",
                    item: {
                        id: "group",
                        kind: "group",
                        text: "Ideas",
                        x: 0,
                        y: 0,
                        width: 500,
                        height: 300,
                    },
                },
                {
                    type: "add",
                    item: {
                        id: "card",
                        kind: "card",
                        text: "First",
                        x: 20,
                        y: 30,
                        width: 200,
                        height: 120,
                        groupId: "group",
                    },
                },
            ],
        }));
        const moved = applyCanvas(added, {
            expectedRevision: 1,
            operations: [
                {
                    type: "move",
                    id: "group",
                    x: 100,
                    y: 200,
                },
            ],
        });
        expect(moved.items.find(item => {

            return item.id === "card";
        })).toMatchObject({
            placement: {
                x: 120,
                y: 230,
            },
        });
        const restored = readCanvas({
            ...dashboard,
            viewState: writeCanvasViewState(dashboard, moved),
        });
        expect(restored).toEqual(moved);
        const undone = applyCanvas(restored, {
            expectedRevision: 2,
            operations: [{ type: "undo" }],
        });
        expect(undone.items.find(item => {

            return item.id === "card";
        })).toMatchObject({
            placement: {
                x: 20,
                y: 30,
            },
        });
    });

    it("upgrades saved card frames and preserves cited source details after removal", () => {

        const old = readCanvas({
            ...dashboard,
            viewState: {
                canvas: {
                    revision: 1,
                    items: [
                        {
                            id: "old",
                            kind: "card",
                            text: "Earlier idea",
                            x: 1,
                            y: 2,
                            width: 200,
                            height: 120,
                        },
                    ],
                    links: [],
                    history: [
                        {
                            items: [],
                            links: [],
                        },
                    ],
                },
            },
        });
        expect(old.schemaVersion).toBe(2);
        expect(old.items[0]).toMatchObject({
            content: {
                kind: "idea",
                text: "Earlier idea",
                version: 1,
            },
            placement: {
                x: 1,
                y: 2,
            },
        });
        const added = applyCanvas(old, parseCanvasCommand({
            expectedRevision: 1,
            operations: [
                {
                    type: "add",
                    item: {
                        id: "source",
                        content: {
                            kind: "source",
                            version: 1,
                            text: "Reference",
                            url: "https://example.com",
                            excerpt: "A saved excerpt",
                        },
                        placement: {
                            x: 220,
                            y: 2,
                            width: 280,
                            height: 180,
                        },
                    },
                },
                {
                    type: "add",
                    item: {
                        id: "result",
                        content: {
                            kind: "result",
                            version: 1,
                            text: "Conclusion",
                            evidence: [
                                {
                                    itemId: "source",
                                    label: "Reference",
                                    url: "https://example.com",
                                    excerpt: "A saved excerpt",
                                },
                            ],
                        },
                        placement: {
                            x: 520,
                            y: 2,
                            width: 280,
                            height: 220,
                        },
                    },
                },
            ],
        }));
        const removed = applyCanvas(added, {
            expectedRevision: 2,
            operations: [
                {
                    type: "remove",
                    id: "source",
                },
            ],
        });
        expect(removed.items.find(item => {

            return item.id === "result";
        })?.content).toMatchObject({
            evidence: [
                {
                    itemId: "source",
                    label: "Reference",
                    url: "https://example.com",
                    excerpt: "A saved excerpt",
                },
            ],
        });
        expect(readCanvas({
            ...dashboard,
            viewState: writeCanvasViewState(dashboard, removed),
        })).toEqual(removed);
        expect(applyCanvas(removed, {
            expectedRevision: 3,
            operations: [{ type: "undo" }],
        }).items.some(item => {

            return item.id === "source";
        })).toBe(true);
    });

    it("removes links to cards deleted with a group", () => {

        const initial = applyCanvas(readCanvas(dashboard), parseCanvasCommand({
            expectedRevision: 0,
            operations: [
                ...[
                    {
                        id: "group",
                        kind: "group",
                        groupId: undefined,
                    },
                    {
                        id: "child",
                        kind: "card",
                        groupId: "group",
                    },
                    {
                        id: "outside",
                        kind: "card",
                        groupId: undefined,
                    },
                ].map(value => {

                    return {
                        type: "add",
                        item: {
                            id: value.id,
                            kind: value.kind,
                            text: value.id,
                            x: 0,
                            y: 0,
                            width: 200,
                            height: 120,
                            ...(value.groupId ? { groupId: value.groupId } : {}),
                        },
                    };
                }),
                {
                    type: "link",
                    link: {
                        id: "connected",
                        from: "child",
                        to: "outside",
                    },
                },
            ],
        }));
        const removed = applyCanvas(initial, {
            expectedRevision: 1,
            operations: [
                {
                    type: "remove",
                    id: "group",
                },
            ],
        });

        expect(removed.items.map(value => {

            return value.id;
        })).toEqual(["outside"]);
        expect(removed.links).toEqual([]);
        expect(applyCanvas(removed, {
            expectedRevision: 2,
            operations: [{ type: "undo" }],
        }).links).toEqual(initial.links);
    });

    it("rejects unsafe source URLs and unknown result evidence", () => {

        expect(() => {

            return parseCanvasCommand({
                expectedRevision: 0,
                operations: [
                    {
                        type: "add",
                        item: {
                            id: "source",
                            content: {
                                kind: "source",
                                version: 1,
                                text: "Unsafe",
                                url: "javascript:alert(1)",
                            },
                            placement: {
                                x: 0,
                                y: 0,
                                width: 280,
                                height: 180,
                            },
                        },
                    },
                ],
            });
        }).toThrow("HTTP or HTTPS");
        const command = parseCanvasCommand({
            expectedRevision: 0,
            operations: [
                {
                    type: "add",
                    item: {
                        id: "result",
                        content: {
                            kind: "result",
                            version: 1,
                            text: "Unsupported",
                            evidence: [
                                {
                                    itemId: "missing",
                                    label: "Missing",
                                },
                            ],
                        },
                        placement: {
                            x: 0,
                            y: 0,
                            width: 280,
                            height: 220,
                        },
                    },
                },
            ],
        });
        expect(() => {

            return applyCanvas(readCanvas(dashboard), command);
        }).toThrow("evidence");
    });

    it("rejects stale edits and dangling links", () => {

        const initial = readCanvas(dashboard);
        expect(() => {

            return applyCanvas(initial, {
                expectedRevision: 1,
                operations: [{ type: "undo" }],
            });
        }).toThrow("changed");
        expect(() => {

            return applyCanvas(initial, {
                expectedRevision: 0,
                operations: [
                    {
                        type: "link",
                        link: {
                            id: "link",
                            from: "missing",
                            to: "other",
                        },
                    },
                ],
            });
        }).toThrow("references");
    });
});

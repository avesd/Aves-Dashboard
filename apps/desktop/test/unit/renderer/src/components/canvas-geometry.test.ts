import { fitViewport, placeCanvasItem } from "../../../../../src/renderer/src/components/canvas-geometry";
import type { CanvasItem } from "@avesd/workspace-model";
import { expect, it } from "vitest";

it("places new cards away from existing cards and fits their bounds", () => {

    const existing: CanvasItem[] = [
        {
            id: "first",
            content: {
                kind: "idea",
                version: 1,
                text: "First",
            },
            placement: {
                x: 360,
                y: 260,
                width: 280,
                height: 180,
            },
        },
    ];
    const viewport = {
        x: 0,
        y: 0,
        zoom: 1,
    };
    const next = placeCanvasItem({
        kind: "idea",
        version: 1,
        text: "Second",
    }, existing, viewport, {
        width: 1_000,
        height: 700,
    });

    const first = existing[0]!.placement;
    expect(next.position.x >= first.x + first.width || next.position.x + next.width <= first.x
        || next.position.y >= first.y + first.height || next.position.y + next.height <= first.y).toBe(true);
    const fitted = fitViewport([
        ...existing,
        {
            id: "second",
            content: {
                kind: "idea",
                version: 1,
                text: "Second",
            },
            placement: {
                ...next.position,
                width: next.width,
                height: next.height,
            },
        },
    ], 1_000, 700);
    expect(fitted.zoom).toBeGreaterThanOrEqual(0.2);
    expect(fitted.zoom).toBeLessThanOrEqual(1);
    for (const placement of [
        first,
        {
            ...next.position,
            width: next.width,
            height: next.height,
        },
    ]) {
        expect(placement.x * fitted.zoom + fitted.x).toBeGreaterThanOrEqual(0);
        expect((placement.x + placement.width) * fitted.zoom + fitted.x).toBeLessThanOrEqual(1_000);
        expect(placement.y * fitted.zoom + fitted.y).toBeGreaterThanOrEqual(0);
        expect((placement.y + placement.height) * fitted.zoom + fitted.y).toBeLessThanOrEqual(700);
    }
});

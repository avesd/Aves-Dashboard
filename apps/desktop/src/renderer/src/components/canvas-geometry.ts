import type { CanvasContent, CanvasItem } from "@avesd/workspace-model";

export interface Viewport {
    x: number;
    y: number;
    zoom: number;
}

interface CanvasSize {
    readonly width: number;
    readonly height: number;
}

export const initialViewport: Viewport = {
    x: 0,
    y: 0,
    zoom: 1,
};

export const fitViewport = (items: readonly CanvasItem[], width: number, height: number): Viewport => {

    if (!items.length) {
        return initialViewport;
    }
    const left = Math.min(...items.map(item => {

        return item.placement.x;
    }));
    const top = Math.min(...items.map(item => {

        return item.placement.y;
    }));
    const right = Math.max(...items.map(item => {

        return item.placement.x + item.placement.width;
    }));
    const bottom = Math.max(...items.map(item => {

        return item.placement.y + item.placement.height;
    }));
    const zoom = Math.max(0.2, Math.min(1, (width - 180) / (right - left), (height - 300) / (bottom - top)));

    return {
        x: (width - (right - left) * zoom) / 2 - left * zoom,
        y: (height - (bottom - top) * zoom) / 2 - top * zoom,
        zoom,
    };
};

export const placeCanvasItem = (content: CanvasContent, existing: readonly CanvasItem[], viewport: Viewport, rect?: CanvasSize) => {

    const centerX = rect ? (rect.width / 2 - viewport.x) / viewport.zoom : 320;
    const centerY = rect ? (rect.height / 2 - viewport.y) / viewport.zoom : 240;
    const group = content.kind === "group";
    const width = group ? 540 : 280;
    const height = group ? 360 : content.kind === "result" ? 220 : content.kind === "source" ? 260 : 180;
    const baseX = Math.round(centerX - width / 2);
    const baseY = Math.round(centerY - height / 2);
    let position = {
        x: baseX,
        y: baseY,
    };
    let bestScore = Infinity;
    for (let ring = 0; ring < 8; ring++) {
        for (let dy = -ring; dy <= ring; dy++) {
            for (let dx = -ring; dx <= ring; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
                    continue;
                }
                const x = baseX + dx * 312;
                const y = baseY + dy * 260;
                if (existing.some(item => {

                    const other = item.placement;

                    return x < other.x + other.width + 24 && x + width + 24 > other.x
                            && y < other.y + other.height + 24 && y + height + 24 > other.y;
                })) {
                    continue;
                }
                const left = x * viewport.zoom + viewport.x;
                const right = (x + width) * viewport.zoom + viewport.x;
                const top = y * viewport.zoom + viewport.y;
                const bottom = (y + height) * viewport.zoom + viewport.y;
                const overflow = rect ? Math.max(0, 20 - left) + Math.max(0, right - rect.width + 90)
                        + Math.max(0, 100 - top) + Math.max(0, bottom - rect.height + 110) : 0;
                const score = overflow * 1_000 + (Math.abs(dx) + Math.abs(dy)) * 10
                        + Math.abs(dy) * 2 + (dx > 0 ? 1 : 0);
                if (score < bestScore) {
                    bestScore = score;
                    position = {
                        x,
                        y,
                    };
                }
            }
        }
    }
    if (!Number.isFinite(bestScore) && existing.length) {
        position = {
            x: Math.max(...existing.map(item => {

                return item.placement.x + item.placement.width;
            })) + 32,
            y: baseY,
        };
        bestScore = 1_000;
    }

    return {
        position,
        width,
        height,
        shouldFit: bestScore >= 1_000,
    };
};

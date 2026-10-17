/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Grid
 * @description Tracks
 */

import type { GridColumns } from "../responsive";

export const gridColumnCount = (columns: GridColumns): number => {

    return typeof columns === "number" ? columns : columns.length;
};

export const gridTemplate = (columns: GridColumns): string => {

    if (typeof columns === "number") {
        return `repeat(${columns}, minmax(0, 1fr))`;
    }

    return columns.map((track) => {

        return track === "1fr" ? "minmax(0, 1fr)" : track;
    }).join(" ");
};

// Fill incomplete rows before the next item wraps or starts a full-width row.
export const fillGridRowSpans = (columns: number, spans: readonly number[]): number[] => {

    let occupied = 0;

    return spans.map((span, index) => {

        if (span < 1 || span > columns) {
            throw new RangeError("Grid item spans must fit within the grid columns.");
        }
        if (occupied + span > columns) {
            occupied = 0;
        }
        occupied += span;
        const next = spans[index + 1];
        if (next === undefined || occupied + next > columns) {
            const filled = span + columns - occupied;
            occupied = 0;

            return filled;
        }
        if (occupied === columns) {
            occupied = 0;
        }

        return span;
    });
};

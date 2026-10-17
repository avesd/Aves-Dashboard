/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives
 * @description Responsive
 */

import type { CSSProperties } from "react";

export type Space = 0 | 4 | 8 | 16 | 24 | 32 | 48 | 64;
export type Columns = 1 | 2 | 3 | 4 | 6 | 12;
export type GridTrack = "1fr" | "auto";
export type GridColumns = Columns | readonly [GridTrack, ...GridTrack[]];
export type Span = Columns | 5 | 7 | 8 | 9 | 10 | 11 | "full";
export type Responsive<T extends string | number | readonly string[]> = T | {
    readonly base: T;
    readonly md?: T;
    readonly lg?: T;
};

export const resolveResponsive = <T extends string | number | readonly string[]>(value: Responsive<T>,
): {
    base: T;
    md: T;
    lg: T;
} => {

    if (typeof value !== "object" || !("base" in value)) {
        return {
            base: value,
            md: value,
            lg: value,
        };
    }

    return {
        base: value.base,
        md: value.md ?? value.base,
        lg: value.lg ?? value.md ?? value.base,
    };
};

export const spaceValue = (value: Space): string => {

    return `var(--avesd-space-${value})`;
};

export const spanValue = (value: Span): string => {

    return value === "full" ? "1 / -1" : `span ${value} / span ${value}`;
};

export const spacingStyle = (name: string, value: Responsive<Space>): CSSProperties & {
    [key: `--avesd-${string}`]: string | number;
} => {

    const sizes = resolveResponsive(value);

    return {
        [`--avesd-${name}`]: spaceValue(sizes.base),
        [`--avesd-${name}-md`]: spaceValue(sizes.md),
        [`--avesd-${name}-lg`]: spaceValue(sizes.lg),
    };
};

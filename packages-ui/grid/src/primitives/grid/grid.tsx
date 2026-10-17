/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Grid
 * @description Grid
 */

import type { GridColumns, Responsive, Space } from "../responsive";
import { resolveResponsive, spaceValue } from "../responsive";
import type { ElementProps, LayoutStyle } from "../types";
import type { GridItemProps } from "./grid-item";
import { GridItem } from "./grid-item";
import { gridVariants } from "./style";
import { fillGridRowSpans, gridColumnCount, gridTemplate } from "./tracks";
import { cn } from "@avesd/ui-style-utils";
import type { FC } from "react";
import { Children, cloneElement, isValidElement } from "react";

export type GridProps = ElementProps & {
    readonly columns?: Responsive<GridColumns>;
    readonly fillLastRow?: boolean;
} & ({
    readonly frame?: "none";
    readonly gap?: Responsive<Space>;
} | {
    readonly frame: "cells" | "internal";
    readonly gap?: never;
});

export const Grid: FC<GridProps> = (props: GridProps) => {

    const {
        columns = 1,
        frame = "none",
        gap = 16,
        fillLastRow = false,
        className,
        style,
        children,
        ...restProps
    } = props;
    const tracks = resolveResponsive(columns);
    const count = {
        base: gridColumnCount(tracks.base),
        md: gridColumnCount(tracks.md),
        lg: gridColumnCount(tracks.lg),
    };
    const spacing = resolveResponsive(frame === "none" ? gap : 0);
    const layoutStyle: LayoutStyle = {
        "--avesd-columns": count.base,
        "--avesd-columns-md": count.md,
        "--avesd-columns-lg": count.lg,
        "--avesd-grid-template": gridTemplate(tracks.base),
        "--avesd-grid-template-md": gridTemplate(tracks.md),
        "--avesd-grid-template-lg": gridTemplate(tracks.lg),
        "--avesd-gap": frame === "internal" ? "1px" : spaceValue(spacing.base),
        "--avesd-gap-md": frame === "internal" ? "1px" : spaceValue(spacing.md),
        "--avesd-gap-lg": frame === "internal" ? "1px" : spaceValue(spacing.lg),
        ...style,
    };
    let content = children;
    if (fillLastRow) {
        const items = Children.toArray(children).map((child) => {

            if (!isValidElement<GridItemProps>(child) || child.type !== GridItem) {
                throw new TypeError("Grid fillLastRow requires direct GridItem children.");
            }

            return child;
        });
        const spans = items.map((item) => {

            return resolveResponsive(item.props.span ?? 1);
        });
        const filled = {
            base: fillGridRowSpans(count.base, spans.map((span) => {

                return span.base === "full" ? count.base : span.base;
            })),
            md: fillGridRowSpans(count.md, spans.map((span) => {

                return span.md === "full" ? count.md : span.md;
            })),
            lg: fillGridRowSpans(count.lg, spans.map((span) => {

                return span.lg === "full" ? count.lg : span.lg;
            })),
        };
        content = items.map((item, index) => {

            const itemStyle: LayoutStyle = {
                "--avesd-span": `span ${filled.base[index]} / span ${filled.base[index]}`,
                "--avesd-span-md": `span ${filled.md[index]} / span ${filled.md[index]}`,
                "--avesd-span-lg": `span ${filled.lg[index]} / span ${filled.lg[index]}`,
                ...item.props.style,
            };

            return cloneElement(item, {
                style: itemStyle,
            });
        });
    }

    return (<div
        {...restProps}
        className={cn(gridVariants({ frame }), className)}
        style={layoutStyle}
    >
        {content}
    </div>);
};

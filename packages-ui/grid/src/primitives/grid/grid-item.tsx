/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Grid
 * @description Grid Item
 */

import type { Responsive, Space, Span } from "../responsive";
import { resolveResponsive, spaceValue, spanValue } from "../responsive";
import type { ElementProps, LayoutStyle } from "../types";
import { gridItemStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { FC } from "react";

export type GridItemProps = ElementProps & {
    readonly span?: Responsive<Span>;
    readonly padding?: Responsive<Space>;
    readonly align?: "end" | "center";
};

export const GridItem: FC<GridItemProps> = (props: GridItemProps) => {

    const {
        span = 1,
        padding = 0,
        align,
        className,
        style,
        ...restProps
    } = props;
    const size = resolveResponsive(span);
    const inset = resolveResponsive(padding);
    const layoutStyle: LayoutStyle = {
        "--avesd-span": spanValue(size.base),
        "--avesd-span-md": spanValue(size.md),
        "--avesd-span-lg": spanValue(size.lg),
        "--avesd-padding": spaceValue(inset.base),
        "--avesd-padding-md": spaceValue(inset.md),
        "--avesd-padding-lg": spaceValue(inset.lg),
        ...(align ? {
            display: "flex",
            alignItems: align,
        } : {}),
        ...style,
    };

    return (<div
        {...restProps}
        className={cn(gridItemStyles(), className)}
        style={layoutStyle}
    />);
};

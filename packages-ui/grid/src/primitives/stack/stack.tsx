/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Stack
 * @description Stack
 */

import type { Responsive, Space } from "../responsive";
import { resolveResponsive, spaceValue } from "../responsive";
import type { ElementProps, LayoutStyle } from "../types";
import { stackStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { CSSProperties, FC } from "react";

export type StackProps = ElementProps & {
    readonly gap?: Responsive<Space>;
    readonly width?: "full";
    readonly maxWidth?: CSSProperties["maxWidth"];
    readonly paddingStart?: Space;
};

export const Stack: FC<StackProps> = (props: StackProps) => {

    const {
        gap = 16,
        width,
        maxWidth,
        paddingStart,
        className,
        style,
        ...restProps
    } = props;
    const spacing = resolveResponsive(gap);
    const layoutStyle: LayoutStyle = {
        "--avesd-gap": spaceValue(spacing.base),
        "--avesd-gap-md": spaceValue(spacing.md),
        "--avesd-gap-lg": spaceValue(spacing.lg),
        width: width === "full" ? "100%" : undefined,
        maxWidth,
        paddingTop: paddingStart === undefined ? undefined : spaceValue(paddingStart),
        ...style,
    };

    return (<div
        {...restProps}
        className={cn(stackStyles(), className)}
        style={layoutStyle}
    />);
};

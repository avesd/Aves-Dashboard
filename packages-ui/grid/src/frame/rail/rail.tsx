/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Rail
 * @description Rail
 */

import type { Responsive, Space } from "../../primitives/responsive";
import { resolveResponsive, spaceValue } from "../../primitives/responsive";
import { frameRailContentStyles, frameRailStickyBottomStyles, frameRailStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, CSSProperties, FC, ReactNode } from "react";

export type FrameRailProps = ComponentPropsWithRef<"div"> & {
    readonly placement?: "start" | "sticky-bottom";
};

export const FrameRail: FC<FrameRailProps> = (props: FrameRailProps) => {

    const {
        placement = "start",
        children,
        className,
        ...restProps
    } = props;

    return (<div
        {...restProps}
        className={cn(frameRailStyles(), placement === "sticky-bottom" && frameRailStickyBottomStyles(), className)}
    >
        <div
            className={frameRailContentStyles()}
        >
            {children}
        </div>
    </div>);
};

export type FrameRailGroupProps = ComponentPropsWithRef<"div"> & {
    readonly rail?: ReactNode;
    readonly railWidth?: Responsive<Space>;
};

export const FrameRailGroup: FC<FrameRailGroupProps> = (props: FrameRailGroupProps) => {

    const { rail, railWidth = {
        base: 0,
        md: 32,
    }, children, className, style, ...restProps } = props;
    const hasRail = rail !== undefined && rail !== null && rail !== false;
    const width = resolveResponsive(hasRail ? railWidth : 0);
    const layoutStyle: CSSProperties & {
        [key: `--avesd-${string}`]: string | number;
    } = {
        "--avesd-rail-width-base": spaceValue(width.base),
        "--avesd-rail-width-md": spaceValue(width.md),
        "--avesd-rail-width-lg": spaceValue(width.lg),
        "--avesd-rail-display-base": width.base === 0 ? "none" : "block",
        "--avesd-rail-display-md": width.md === 0 ? "none" : "block",
        "--avesd-rail-display-lg": width.lg === 0 ? "none" : "block",
        ...style,
    };

    return (<div
        {...restProps}
        className={cn("avesd-frame-rail-group", className)}
        style={layoutStyle}
    >
        {hasRail ? (<div
            className="avesd-frame-rail-track"
        >
            {rail}
        </div>) : null}
        <div
            className="avesd-frame-rail-body"
        >
            {children}
        </div>
    </div>);
};

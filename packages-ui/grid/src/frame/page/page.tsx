/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Page
 * @description Page
 */

import type { ContainerProps } from "../../primitives/container/container";
import type { Responsive, Space } from "../../primitives/responsive";
import { spacingStyle } from "../../primitives/responsive";
import type { FrameRailGroupProps } from "../rail/rail";
import { FrameRailGroup } from "../rail/rail";
import { frameContentStyles } from "../style";
import { pageFrameVariants } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, FC, ReactNode } from "react";

export type PageFrameProps = FrameRailGroupProps & {
    readonly width?: ContainerProps["width"];
    readonly header?: ReactNode;
    readonly footer?: ReactNode;
    readonly railScope?: "page" | "main";
    readonly mainGutterStart?: Responsive<Space>;
};

export type FrameSectionsProps = ComponentPropsWithRef<"div">;

export const FrameSections: FC<FrameSectionsProps> = (props: FrameSectionsProps) => {

    const { className, ...restProps } = props;

    return (<div
        {...restProps}
        className={cn("avesd-frame-sections", className)}
    />);
};

export const PageFrame: FC<PageFrameProps> = (props: PageFrameProps) => {

    const {
        width = "standard",
        header,
        footer,
        rail,
        railWidth,
        railScope = "page",
        mainGutterStart,
        children,
        className,
        ...restProps
    } = props;
    const railOptions = railWidth === undefined ? {} : { railWidth };
    const content = (<>
        <FrameSections>
            {children}
        </FrameSections>
        <div
            className="avesd-container avesd-frame-fill"
            aria-hidden="true"
        >
            <div
                className={cn(frameContentStyles())}
            />
        </div>
    </>);

    return (<FrameRailGroup
        {...restProps}
        rail={railScope === "page" ? rail : undefined}
        {...railOptions}
        className={cn(pageFrameVariants({ width }), className)}
    >
        {header ? (<div
            className="avesd-frame-page-header"
        >
            {header}
        </div>) : null}
        <main
            className="avesd-frame-main"
            style={mainGutterStart === undefined ? undefined : spacingStyle("main-gutter-start", mainGutterStart)}
        >
            {railScope === "main" && rail !== undefined && rail !== null && rail !== false ? (<FrameRailGroup
                rail={rail}
                {...railOptions}
                className="avesd-frame-main-rail-group"
            >
                {content}
            </FrameRailGroup>) : content}
        </main>
        {footer ? (<div
            className="avesd-frame-page-footer"
        >
            {footer}
        </div>) : null}
    </FrameRailGroup>);
};

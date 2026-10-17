/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Chrome
 * @description Chrome
 */

import type { Responsive, Space } from "../../primitives/responsive";
import { resolveResponsive, spaceValue } from "../../primitives/responsive";
import type { FrameBoundaryStyle } from "../boundary/boundary";
import { FrameBoundary } from "../boundary/boundary";
import type { FrameDecorationStyle } from "../decoration/decoration";
import { FrameDecoration, resolveFrameDecoration } from "../decoration/decoration";
import type { FrameTone } from "../style";
import { frameContentStyles, frameToneStyles } from "../style";
import { frameChromeStyles, frameSignatureCroppedStyles, frameSignatureStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, CSSProperties, FC, ReactNode } from "react";

export type ChromeProps = {
    readonly padding?: Responsive<Space>;
};

const chromeStyle = (padding: Responsive<Space>): CSSProperties & {
    "--avesd-chrome-padding": string;
    "--avesd-chrome-padding-md": string;
    "--avesd-chrome-padding-lg": string;
} => {

    const values = resolveResponsive(padding);

    return {
        "--avesd-chrome-padding": spaceValue(values.base),
        "--avesd-chrome-padding-md": spaceValue(values.md),
        "--avesd-chrome-padding-lg": spaceValue(values.lg),
    };
};

export type FrameHeaderProps = ComponentPropsWithRef<"header"> & ChromeProps & {
    readonly wrap?: boolean;
    readonly gap?: Space;
};

export const FrameHeader: FC<FrameHeaderProps> = (props: FrameHeaderProps) => {

    const { padding = {
        base: 16,
        md: 24,
    }, wrap = true, gap = 16, className, children, ...restProps } = props;

    return (<header
        {...restProps}
        className={cn("avesd-container avesd-frame-header", className)}
    >
        <div
            className={cn(frameContentStyles(), frameChromeStyles())}
            style={{
                ...chromeStyle(padding),
                flexWrap: wrap ? "wrap" : "nowrap",
                gap: spaceValue(gap),
            }}
        >
            {children}
        </div>
    </header>);
};

export type FrameFooterProps = ComponentPropsWithRef<"footer"> & ChromeProps & {
    readonly tone?: FrameTone;
    readonly boundary?: FrameBoundaryStyle;
    readonly decoration?: FrameDecorationStyle;
    readonly signature?: ReactNode;
    readonly signatureAppearance?: "standard" | "cropped";
};

export const FrameFooter: FC<FrameFooterProps> = (props: FrameFooterProps) => {

    const { padding = {
        base: 16,
        md: 24,
    }, tone = "neutral", boundary = "line", decoration, signature, signatureAppearance = "standard", className, children, ...restProps } = props;

    return (<footer
        {...restProps}
        className={cn("avesd-container avesd-frame-footer", frameToneStyles({
            tone,
        }), className)}
    >
        <FrameBoundary
            boundary={boundary}
        />
        <div
            className={cn(frameContentStyles(), frameChromeStyles(), "avesd-frame-surface")}
            style={chromeStyle(padding)}
        >
            {children}
            <FrameDecoration
                decoration={resolveFrameDecoration(boundary, decoration)}
            />
        </div>
        {signature ? (<div
            className={cn(frameContentStyles(), frameSignatureStyles(), signatureAppearance === "cropped" && frameSignatureCroppedStyles())}
            aria-hidden="true"
            inert
        >
            {signature}
        </div>) : null}
    </footer>);
};

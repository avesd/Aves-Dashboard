/**
 * @author Avesd
 * @package Grid
 * @namespace Frame
 * @description Section
 */

import type { FrameBoundaryStyle } from "./boundary/boundary";
import { FrameBoundary } from "./boundary/boundary";
import type { FrameDecorationStyle } from "./decoration/decoration";
import { FrameDecoration, resolveFrameDecoration } from "./decoration/decoration";
import type { FrameTone } from "./style";
import { frameContentStyles, frameToneStyles } from "./style";
import type { FrameTextureStyle } from "./texture/texture";
import { FrameTexture } from "./texture/texture";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, FC } from "react";

export type FrameSectionProps = ComponentPropsWithRef<"section"> & {
    readonly tone?: FrameTone;
    readonly boundary?: FrameBoundaryStyle;
    readonly decoration?: FrameDecorationStyle;
    readonly texture?: FrameTextureStyle;
    readonly edges?: "frame" | "none";
};

export const FrameSection: FC<FrameSectionProps> = (props: FrameSectionProps) => {

    const {
        tone = "neutral",
        boundary = "line",
        decoration,
        texture = "none",
        edges = "frame",
        className,
        children,
        ...restProps
    } = props;

    return (<section
        {...restProps}
        className={cn("avesd-container avesd-frame-section", frameToneStyles({ tone }), className)}
        data-edges={edges}
    >
        <FrameBoundary
            boundary={boundary}
        />
        <div
            className={cn(frameContentStyles(), "avesd-frame-surface", edges === "none" && "border-x-0")}
        >
            <FrameTexture
                texture={texture}
            />
            {children}
            <FrameDecoration
                decoration={resolveFrameDecoration(boundary, decoration)}
            />
        </div>
    </section>);
};

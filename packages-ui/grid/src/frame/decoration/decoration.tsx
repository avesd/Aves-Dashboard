/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Decoration
 * @description Decoration
 */

import type { FrameBoundaryStyle } from "../boundary/boundary";
import type { FC } from "react";

export type FrameDecorationStyle = "none" | "nodes" | "marks" | "corners" | "ticks";

export const resolveFrameDecoration = (
    boundary: FrameBoundaryStyle,
    decoration?: FrameDecorationStyle,
): FrameDecorationStyle => {

    return decoration ?? (boundary === "band" ? "nodes" : "none");
};

export type FrameDecorationProps = {
    readonly decoration: FrameDecorationStyle;
};

export const FrameDecoration: FC<FrameDecorationProps> = (props: FrameDecorationProps) => {

    const { decoration } = props;

    return decoration === "none" ? null : (<div
        className="avesd-frame-decoration"
        data-decoration={decoration}
        aria-hidden="true"
        inert
    />);
};

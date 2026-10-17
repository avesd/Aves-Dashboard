/**
 * @author Avesd
 * @package Grid
 * @namespace Frame_Boundary
 * @description Boundary
 */

import { cn } from "@avesd/ui-style-utils";
import type { FC } from "react";

export type FrameBoundaryStyle = "none" | "line" | "band" | "stripe" | "space";

export type FrameBoundaryProps = {
    readonly boundary: FrameBoundaryStyle;
};

export const FrameBoundary: FC<FrameBoundaryProps> = (props: FrameBoundaryProps) => {

    const { boundary } = props;

    return boundary === "none" ? null : (<div
        className={cn(
            "avesd-frame-boundary",
            (boundary === "band" || boundary === "stripe") && "avesd-frame-divider",
            boundary === "stripe" && "avesd-frame-stripe",
            boundary === "space" && "avesd-frame-space",
        )}
        aria-hidden="true"
    />);
};

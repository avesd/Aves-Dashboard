import { cn } from "../shared/cn";
import { frameSectionStyle } from "./style";
import type { ComponentPropsWithRef } from "react";

export type FrameProps = ComponentPropsWithRef<"div">;
export interface FrameSectionProps extends ComponentPropsWithRef<"section"> {
    readonly padding?: "none" | "normal";
}

export function Frame({ className, ...props }: FrameProps) {

    return <div
        className={cn("avesd-frame", className)}
        {...props}
    />;
}

export function FrameSection({ className, padding, ...props }: FrameSectionProps) {

    return <section
        className={cn(frameSectionStyle({ padding }), className)}
        {...props}
    />;
}

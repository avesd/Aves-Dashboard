import { cn } from "../shared/cn";
import type { ComponentPropsWithRef } from "react";

export interface SelectionIndicatorProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
    readonly active: boolean;
}

/** Decorative selection treatment; the host owns selection and keyboard focus. */
export function SelectionIndicator({ active, className, ...props }: SelectionIndicatorProps) {

    if (!active) {
        return null;
    }

    return <span
        {...props}
        className={cn("avesd-selection-indicator", className)}
        aria-hidden="true"
    >
        <span
            className="avesd-selection-corner is-top-start"
        />
        <span
            className="avesd-selection-corner is-top-end"
        />
        <span
            className="avesd-selection-corner is-bottom-start"
        />
        <span
            className="avesd-selection-corner is-bottom-end"
        />
    </span>;
}

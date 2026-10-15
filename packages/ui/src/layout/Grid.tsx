import { cn } from "../shared/cn";
import { gridStyle } from "./style";
import type { ComponentPropsWithRef } from "react";

export interface GridProps extends ComponentPropsWithRef<"div"> {
    readonly columns?: 1 | 2;
}
export type GridCellProps = ComponentPropsWithRef<"div">;

export function Grid({ className, columns, children, ...props }: GridProps) {

    return <div
        className={cn(gridStyle({ columns }), className)}
        {...props}
    >
        <div
            className="avesd-grid-tracks"
        >
            {children}
        </div>
    </div>;
}

export function GridCell({ className, ...props }: GridCellProps) {

    return <div
        className={cn("avesd-grid-cell", className)}
        {...props}
    />;
}

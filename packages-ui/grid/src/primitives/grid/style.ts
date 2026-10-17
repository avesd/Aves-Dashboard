/**
 * @author Avesd
 * @package Grid
 * @namespace Primitives_Grid
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const gridStyles = cva(cn(
    "avesd-grid",
    "grid min-w-0",
));

export const gridCellsStyles = cva(cn(
    "avesd-grid-cells",
    "border-t border-solid border-border border-l border-solid border-border",
));

export const gridItemStyles = cva(cn(
    "avesd-grid-item",
    "min-w-0 wrap-anywhere",
));

export const gridInternalStyles = cva(cn(
    "avesd-grid-internal",
    "bg-border",
));

export const gridVariants = cva(gridStyles(), {
    variants: {
        frame: {
            none: "",
            cells: gridCellsStyles(),
            internal: gridInternalStyles(),
        },
    },
    defaultVariants: { frame: "none" },
});

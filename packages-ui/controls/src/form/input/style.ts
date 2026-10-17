/**
 * @author Avesd
 * @package Form Controls
 * @namespace Form_Input
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const labelStyles = cva(cn(
    "avesd-label",
    "type-ui",
));

export const controlStyles = cva(cn(
    "avesd-control",
    "min-w-0 w-full box-border border border-solid border-border rounded-control text-foreground bg-background type-input",
    "[&:disabled]:opacity-50 [&:disabled]:cursor-not-allowed",
    "[&[aria-invalid='true']]:border-danger-foreground",
));

export const controlStandardStyles = cva(cn(
    "avesd-control-standard",
    "p-avesd-8 min-h-[44px]",
));

export const controlSmallStyles = cva(cn(
    "avesd-control-small",
    "py-avesd-4 px-avesd-8 min-h-[36px]",
));

export const controlVariants = cva(controlStyles(), {
    variants: {
        size: {
            standard: controlStandardStyles(),
            small: controlSmallStyles(),
        },
    },
    defaultVariants: { size: "standard" },
});

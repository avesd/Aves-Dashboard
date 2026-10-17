/**
 * @author Avesd
 * @package Grid
 * @namespace Frame
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export type FrameTone = "neutral" | "brand" | "warning" | "danger";

export const frameToneStyles = cva("", {
    variants: {
        tone: {
            neutral: "",
            brand: "avesd-frame-brand",
            warning: "avesd-frame-warning",
            danger: "avesd-frame-danger",
        },
    },
});

export const frameContentStyles = cva(cn(
    "avesd-frame-content",
    "border-x border-solid border-border wrap-anywhere",
));

/**
 * @author Avesd
 * @package Data
 * @namespace Display_Cells
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const dataValueStyles = cva(cn(
    "avesd-data-value",
    "grid gap-avesd-4",
    "[&_small]:text-muted [&_small]:type-supporting",
));

export const dataMonoStyles = cva(cn(
    "avesd-data-mono",
    "type-code whitespace-nowrap",
));

export const dataBadgeStyles = cva(cn(
    "avesd-data-badge",
    "inline-block py-avesd-4 px-avesd-8 text-foreground bg-surface type-caption whitespace-nowrap",
    "[&[data-tone='accent']]:text-foreground [&[data-tone='accent']]:bg-brand-tint",
));

export const dataBarStyles = cva(cn(
    "avesd-data-bar",
    "grid min-w-[4rem] gap-avesd-8 tabular-nums",
    "[&[data-partial='true']_.avesd-data-bar-track>span]:bg-transparent",
));

export const dataBarTrackStyles = cva(cn(
    "avesd-data-bar-track",
    "h-[var(--avesd-space-4)] bg-brand-tint",
    "[&_>_span]:block [&_>_span]:h-full [&_>_span]:bg-accent-background",
));

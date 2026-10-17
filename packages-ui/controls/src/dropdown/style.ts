/**
 * @author Avesd
 * @package Controls
 * @namespace Dropdown
 * @description Style
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const dropdownContentStyles = cva(cn(
    "avesd-dropdown-content",
    "z-[50] min-w-[11rem] max-w-[calc(100vw_-_2_*_var(--avesd-page-gutter))] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto p-avesd-4 border border-solid border-border rounded-control text-foreground bg-background type-data",
    "[&[data-state='closed']]:pointer-events-none",
));

export const dropdownItemStyles = cva(cn(
    "avesd-dropdown-item",
    "flex min-h-[40px] items-center gap-avesd-8 p-avesd-8 rounded-[2px] text-inherit no-underline outline-none cursor-pointer",
    "[&[data-highlighted]]:bg-surface",
    "[&[data-disabled]]:opacity-50 [&[data-disabled]]:pointer-events-none",
));

export const dropdownIndicatorStyles = cva(cn(
    "avesd-dropdown-indicator",
    "w-[1rem] shrink-0 text-foreground",
));

export const dropdownLabelStyles = cva(cn(
    "avesd-dropdown-label",
    "p-avesd-8 text-muted type-caption",
));

/**
 * @author Avesd
 * @package UI Layout
 * @namespace Sidebar
 * @description Semantic sidebar navigation and region styles
 */

import { cn } from "@avesd/ui-style-utils";
import { cva } from "class-variance-authority";

export const sidebarRegionStyles = cva("flex shrink-0 items-center gap-avesd-8 p-avesd-16", {
    variants: {
        region: {
            header: "avesd-sidebar-header",
            footer: "avesd-sidebar-footer mt-auto text-muted type-caption",
        },
    },
});

export const sidebarItemStyles = cva(cn(
    "avesd-sidebar-item flex w-full min-w-0 items-center gap-avesd-8 rounded-control border border-transparent px-avesd-8 py-avesd-8 text-left type-ui text-foreground no-underline",
    "hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed",
), {
    variants: {
        active: {
            true: "bg-surface-hover text-accent-background",
            false: "bg-transparent",
        },
    },
});

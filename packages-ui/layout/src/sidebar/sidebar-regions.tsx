/**
 * @author Avesd
 * @package UI Layout
 * @namespace Sidebar
 * @description Sidebar header, scrolling navigation region, footer and labeled groups
 */

import { useSidebar } from "./sidebar-context";
import { sidebarRegionStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { useId } from "react";

type SidebarRegionProps = ComponentPropsWithRef<"div"> & {
    readonly collapsedContent?: ReactNode;
};

export function SidebarHeader({ className, children, title, ...props }: Omit<ComponentPropsWithRef<"div">, "title"> & {
    readonly title?: ReactNode;
}) {

    return <div
        {...props}
        className={cn(sidebarRegionStyles({ region: "header" }), className)}
    >
        {title && <div
            className="avesd-sidebar-heading"
        >
            {title}
        </div>}
        {children}
    </div>;
}

export function SidebarContent({ className, ...props }: ComponentPropsWithRef<"nav">) {

    return <nav
        {...props}
        className={cn("avesd-sidebar-content", className)}
    />;
}

export function SidebarFooter({ className, children, collapsedContent, ...props }: SidebarRegionProps) {

    const { expanded } = useSidebar();

    return <div
        {...props}
        className={cn(sidebarRegionStyles({ region: "footer" }), className)}
    >
        {expanded || collapsedContent === undefined ? children : collapsedContent}
    </div>;
}

export interface SidebarGroupProps extends ComponentPropsWithRef<"div"> {
    readonly label: string;
}

export function SidebarGroup({ label, children, className, ...props }: SidebarGroupProps) {

    const labelId = useId();

    return <div
        {...props}
        role="group"
        aria-labelledby={labelId}
        className={cn("avesd-sidebar-group", className)}
    >
        <div
            id={labelId}
            className="avesd-sidebar-group-label"
        >
            {label}
        </div>
        <ul
            className="avesd-sidebar-menu"
        >
            {children}
        </ul>
    </div>;
}

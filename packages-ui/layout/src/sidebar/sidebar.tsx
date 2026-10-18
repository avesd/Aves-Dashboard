/**
 * @author Avesd
 * @package UI Layout
 * @namespace Sidebar
 * @description Sidebar surface and independently scrolling main content
 */

import { useSidebar } from "./sidebar-context";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef } from "react";

export function Sidebar({ className, children, ...props }: ComponentPropsWithRef<"aside">) {

    const { id } = useSidebar();

    return <aside
        {...props}
        id={id}
        className={cn("avesd-sidebar", className)}
    >
        {children}
    </aside>;
}

export function SidebarMain({ className, ...props }: ComponentPropsWithRef<"main">) {

    return <main
        {...props}
        className={cn("avesd-sidebar-main", className)}
    />;
}

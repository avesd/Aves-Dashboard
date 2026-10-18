/**
 * @author Avesd
 * @package UI Layout
 * @namespace Sidebar
 * @description Native navigation buttons and links with accessible compact labels
 */

import { useSidebar } from "./sidebar-context";
import { sidebarItemStyles } from "./style";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, ReactNode } from "react";

interface SidebarItemContent {
    readonly label: string;
    readonly icon: ReactNode;
    readonly active?: boolean;
}

export type SidebarItemProps = Omit<ComponentPropsWithRef<"button">, "children"> & SidebarItemContent;
export type SidebarLinkProps = Omit<ComponentPropsWithRef<"a">, "children"> & SidebarItemContent & {
    readonly href: string;
};

function ItemContent({ icon, label }: SidebarItemContent) {

    return <>
        <span
            className="avesd-sidebar-item-icon"
            aria-hidden="true"
        >
            {icon}
        </span>
        <span
            className="avesd-sidebar-item-label"
        >
            {label}
        </span>
    </>;
}

export function SidebarItem({ icon, label, active = false, className, type = "button", ...props }: SidebarItemProps) {

    const { expanded } = useSidebar();

    return <li
        className="avesd-sidebar-menu-item"
    >
        <button
            {...props}
            type={type}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={expanded ? undefined : label}
            className={cn(sidebarItemStyles({ active }), className)}
        >
            <ItemContent
                icon={icon}
                label={label}
            />
        </button>
    </li>;
}

export function SidebarLink({ icon, label, active = false, className, ...props }: SidebarLinkProps) {

    const { expanded } = useSidebar();

    return <li
        className="avesd-sidebar-menu-item"
    >
        <a
            {...props}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={expanded ? undefined : label}
            className={cn(sidebarItemStyles({ active }), className)}
        >
            <ItemContent
                icon={icon}
                label={label}
            />
        </a>
    </li>;
}

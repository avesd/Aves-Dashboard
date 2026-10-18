/**
 * @author Avesd
 * @package UI Layout
 * @namespace Sidebar
 * @description Explicit sidebar collapse control without global shortcut interception
 */

import { useSidebar } from "./sidebar-context";
import type { ButtonProps } from "@avesd/ui-controls";
import { Button } from "@avesd/ui-controls";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";

export interface SidebarToggleProps extends Omit<ButtonProps, "children"> {
    readonly expandLabel: string;
    readonly collapseLabel: string;
}

export function SidebarToggle({ expandLabel, collapseLabel, onClick, ...props }: SidebarToggleProps) {

    const { expanded, compact, side, id, toggle } = useSidebar();
    if (compact) {
        return null;
    }
    const icons = {
        left: {
            expanded: PanelLeftClose,
            collapsed: PanelLeftOpen,
        },
        right: {
            expanded: PanelRightClose,
            collapsed: PanelRightOpen,
        },
    };
    const Icon = icons[side][expanded ? "expanded" : "collapsed"];
    const label = expanded ? collapseLabel : expandLabel;

    return <Button
        variant="quiet"
        size="small"
        layout="icon"
        {...props}
        hidden={props.hidden}
        aria-label={label}
        title={label}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={event => {

            onClick?.(event);
            if (!event.defaultPrevented) {
                toggle();
            }
        }}
    >
        <Icon
            aria-hidden="true"
        />
    </Button>;
}

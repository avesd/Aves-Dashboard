/**
 * @author Avesd
 * @package UI Controls
 * @namespace Dropdown
 * @description Controlled context menu anchored to a viewport point
 */

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown";
import type { ReactNode } from "react";
import { useEffect } from "react";

export interface ContextMenuProps {
    readonly x: number;
    readonly y: number;
    readonly label: string;
    readonly children: ReactNode;
    readonly onClose: () => void;
}

/** Uses the same menu semantics and presentation as trigger-based dropdowns. */
export function ContextMenu({ x, y, label, children, onClose }: ContextMenuProps) {

    useEffect(() => {

        const dismissWhenInactive = () => {

            if (!document.hasFocus()) {
                onClose();
            }
        };
        window.addEventListener("blur", dismissWhenInactive);

        return () => {

            window.removeEventListener("blur", dismissWhenInactive);
        };
    }, [onClose]);

    return <DropdownMenu
        key={`${x}:${y}`}
        open
        modal={false}
        onOpenChange={open => {

            if (!open) {
                onClose();
            }
        }}
    >
        <DropdownMenuTrigger
            asChild
        >
            <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                style={{
                    position: "fixed",
                    left: x,
                    top: y,
                    width: 0,
                    height: 0,
                    padding: 0,
                    border: 0,
                    opacity: 0,
                    pointerEvents: "none",
                }}
            />
        </DropdownMenuTrigger>
        <DropdownMenuContent
            aria-label={label}
            side="bottom"
            align="start"
            sideOffset={0}
            collisionPadding={8}
            onCloseAutoFocus={event => {

                event.preventDefault();
            }}
            onKeyDown={event => {

                if (event.key === "Tab") {
                    event.preventDefault();
                    onClose();
                }
            }}
        >
            {children}
        </DropdownMenuContent>
    </DropdownMenu>;
}

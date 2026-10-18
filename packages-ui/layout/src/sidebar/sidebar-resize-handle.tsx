/**
 * @author Avesd
 * @package UI Layout
 * @namespace Sidebar
 * @description Pointer and keyboard resizing with cancellation and width restoration
 */

import { useSidebar } from "./sidebar-context";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef } from "react";
import { useEffect, useRef } from "react";

export interface SidebarResizeHandleProps extends Omit<ComponentPropsWithRef<"div">, "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel" | "onLostPointerCapture" | "onKeyDown" | "onDoubleClick"> {
    readonly label: string;
}

export function SidebarResizeHandle({ label, className, ...props }: SidebarResizeHandleProps) {

    const { id, side, expanded, width, minWidth, maxWidth, defaultWidth, setWidth, commitWidth, setResizing } = useSidebar();
    const drag = useRef<{
        pointerId: number;
        startX: number;
        startWidth: number;
        currentWidth: number;
        element: HTMLDivElement;
    } | null>(null);
    const direction = side === "left" ? 1 : -1;
    const finish = (commit: boolean) => {

        const current = drag.current;
        if (!current) {
            return;
        }
        drag.current = null;
        if (current.element.hasPointerCapture(current.pointerId)) {
            current.element.releasePointerCapture(current.pointerId);
        }
        setResizing(false);
        if (commit) {
            commitWidth(current.currentWidth);
        } else {
            setWidth(current.startWidth);
        }
    };
    const cancel = useRef(() => {
    });
    cancel.current = () => {

        finish(false);
    };
    useEffect(() => {

        const cancelDrag = () => {

            cancel.current();
        };
        window.addEventListener("blur", cancelDrag);

        return () => {

            window.removeEventListener("blur", cancelDrag);
            cancelDrag();
        };
    }, []);
    useEffect(() => {

        if (!expanded) {
            cancel.current();
        }
    }, [expanded]);

    return <div
        {...props}
        hidden={!expanded || props.hidden}
        role="separator"
        tabIndex={0}
        aria-label={label}
        aria-controls={id}
        aria-orientation="vertical"
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={width}
        aria-valuetext={`${width} pixels`}
        className={cn("avesd-sidebar-resize-handle", className)}
        onPointerDown={event => {

            if (event.button !== 0 || !event.isPrimary || drag.current) {
                return;
            }
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startWidth: width,
                currentWidth: width,
                element: event.currentTarget,
            };
            setResizing(true);
        }}
        onPointerMove={event => {

            const current = drag.current;
            if (!current || current.pointerId !== event.pointerId) {
                return;
            }
            current.currentWidth = Math.min(maxWidth, Math.max(minWidth, Math.round(current.startWidth + direction * (event.clientX - current.startX))));
            setWidth(current.currentWidth);
        }}
        onPointerUp={event => {

            if (drag.current?.pointerId === event.pointerId) {
                finish(true);
            }
        }}
        onPointerCancel={event => {

            if (drag.current?.pointerId === event.pointerId) {
                finish(false);
            }
        }}
        onLostPointerCapture={event => {

            if (drag.current?.pointerId === event.pointerId) {
                finish(false);
            }
        }}
        onDoubleClick={() => {

            commitWidth(defaultWidth);
        }}
        onKeyDown={event => {

            if (event.key === "Escape" && drag.current) {
                event.preventDefault();
                event.stopPropagation();
                finish(false);

                return;
            }
            if (drag.current) {
                return;
            }
            let next: number;
            switch (event.key) {
                case "ArrowLeft":
                    next = width - direction * 16;
                    break;
                case "ArrowRight":
                    next = width + direction * 16;
                    break;
                case "Home":
                    next = minWidth;
                    break;
                case "End":
                    next = maxWidth;
                    break;
                default:
                    return;
            }
            event.preventDefault();
            commitWidth(next);
        }}
    />;
}

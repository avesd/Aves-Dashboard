/**
 * @author Avesd
 * @package UI Layout
 * @namespace Sidebar
 * @description Container-owned sidebar layout with optional controlled state
 */

import { SidebarContext } from "./sidebar-context";
import { cn } from "@avesd/ui-style-utils";
import type { ComponentPropsWithRef, CSSProperties } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export interface SidebarLayoutProps extends ComponentPropsWithRef<"div"> {
    readonly side?: "left" | "right";
    readonly expanded?: boolean;
    readonly defaultExpanded?: boolean;
    readonly onExpandedChange?: (expanded: boolean) => void;
    readonly width?: number;
    readonly defaultWidth?: number;
    readonly minWidth?: number;
    readonly maxWidth?: number;
    readonly onWidthChange?: (width: number) => void;
    readonly onWidthCommit?: (width: number) => void;
}

export function SidebarLayout({ side = "left", expanded: controlledExpanded, defaultExpanded = true, onExpandedChange, width: controlledWidth, defaultWidth = 216, minWidth = 192, maxWidth = 360, onWidthChange, onWidthCommit, className, style, children, ...props }: SidebarLayoutProps) {

    if (![
        minWidth,
        maxWidth,
        defaultWidth,
        controlledWidth ?? defaultWidth,
    ].every(Number.isFinite) || minWidth < 160 || maxWidth < minWidth) {
        throw new Error("Sidebar widths must be finite, with 160 <= minWidth <= maxWidth.");
    }
    const id = useId();
    const container = useRef<HTMLDivElement>(null);
    const [
        internalExpanded,
        setInternalExpanded,
    ] = useState(defaultExpanded);
    const [
        internalWidth,
        setInternalWidth,
    ] = useState(defaultWidth);
    const [
        compact,
        setCompact,
    ] = useState(false);
    const [
        resizing,
        setResizing,
    ] = useState(false);
    const bounded = useCallback((value: number) => {

        return Math.min(maxWidth, Math.max(minWidth, Math.round(value)));
    }, [
        minWidth,
        maxWidth,
    ]);
    const width = bounded(controlledWidth ?? internalWidth);
    const preferredExpanded = controlledExpanded ?? internalExpanded;
    const expanded = preferredExpanded && !compact;
    useEffect(() => {

        const element = container.current;
        if (!element) {
            return;
        }
        const observer = new ResizeObserver(entries => {

            const entry = entries[0];
            if (entry) {
                setCompact(entry.contentRect.width < 640);
            }
        });
        observer.observe(element);

        return () => {

            observer.disconnect();
        };
    }, []);
    const setWidth = useCallback((value: number) => {

        const next = bounded(value);
        if (controlledWidth === undefined) {
            setInternalWidth(next);
        }
        onWidthChange?.(next);
    }, [
        bounded,
        controlledWidth,
        onWidthChange,
    ]);
    const commitWidth = useCallback((value: number) => {

        const next = bounded(value);
        setWidth(next);
        onWidthCommit?.(next);
    }, [
        bounded,
        setWidth,
        onWidthCommit,
    ]);
    const toggle = () => {

        if (compact) {
            return;
        }
        if (controlledExpanded === undefined) {
            setInternalExpanded(!preferredExpanded);
        }
        onExpandedChange?.(!preferredExpanded);
    };

    return <SidebarContext.Provider
        value={{
            id,
            side,
            expanded,
            compact,
            width,
            minWidth,
            maxWidth,
            defaultWidth: bounded(defaultWidth),
            resizing,
            toggle,
            setWidth,
            commitWidth,
            setResizing,
        }}
    >
        <div
            {...props}
            className={cn("avesd-sidebar-layout", className)}
            data-side={side}
            data-state={expanded ? "expanded" : "collapsed"}
            data-compact={compact || undefined}
            data-resizing={resizing || undefined}
            style={{
                ...style,
                "--avesd-sidebar-width": `${width}px`,
            } as CSSProperties}
        >
            <div
                ref={container}
                className="avesd-sidebar-container"
            >
                {children}
            </div>
        </div>
    </SidebarContext.Provider>;
}

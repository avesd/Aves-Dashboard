/**
 * @author Avesd
 * @package UI Layout
 * @namespace Sidebar
 * @description Shared sidebar presentation and width state
 */

import { createContext, useContext } from "react";

export interface SidebarState {
    readonly id: string;
    readonly side: "left" | "right";
    readonly expanded: boolean;
    readonly compact: boolean;
    readonly width: number;
    readonly minWidth: number;
    readonly maxWidth: number;
    readonly defaultWidth: number;
    readonly resizing: boolean;
    readonly toggle: () => void;
    readonly setWidth: (width: number) => void;
    readonly commitWidth: (width: number) => void;
    readonly setResizing: (resizing: boolean) => void;
}

export const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {

    const state = useContext(SidebarContext);
    if (!state) {
        throw new Error("Sidebar components require SidebarLayout.");
    }

    return state;
}

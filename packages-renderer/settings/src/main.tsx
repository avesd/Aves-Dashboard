/**
 * @author Avesd
 * @package Renderer Settings
 * @namespace Root
 * @description Main
 */

import "./styles.css";
import { SettingsWorkspace } from "./components/SettingsWorkspace";
import type { SettingsApi } from "@avesd/desktop-contracts/settings";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

export function mountSettings(root: HTMLElement, api: SettingsApi | undefined): void {

    createRoot(root).render(<StrictMode>
        <SettingsWorkspace
            api={api}
        />
    </StrictMode>);
}

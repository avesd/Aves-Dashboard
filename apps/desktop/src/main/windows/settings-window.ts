/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Windows
 * @description Settings Window
 */

import { isSettingsSender } from "./settings-access";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import { settingsChannels } from "@avesd/desktop-contracts/settings";
import type { IpcMainInvokeEvent } from "electron";
import { BrowserWindow } from "electron";

export class SettingsWindow {
    #window?: BrowserWindow;
    constructor(private readonly preload: string, private readonly load: (window: BrowserWindow) => void) {}
    open(): void {

        const existing = this.#window;
        if (existing && !existing.isDestroyed()) {
            if (existing.isMinimized()) {
                existing.restore();
            }
            existing.show();
            existing.focus();

            return;
        }
        const window = new BrowserWindow({
            title: "Avesd Settings",
            width: 840,
            height: 800,
            minWidth: 560,
            minHeight: 480,
            show: false,
            backgroundColor: "#f5f6f2",
            webPreferences: {
                preload: this.preload,
                contextIsolation: true,
                nodeIntegration: false,
                nodeIntegrationInSubFrames: false,
                sandbox: true,
                webviewTag: false,
                navigateOnDragDrop: false,
                disableDialogs: true,
                partition: "avesd-settings",
            },
        });
        this.#window = window;
        window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {

            return void callback(false);
        });
        window.webContents.session.setPermissionCheckHandler(() => {

            return false;
        });
        window.webContents.setWindowOpenHandler(() => {

            return { action: "deny" };
        });
        window.webContents.on("will-navigate", event => {

            event.preventDefault();
        });
        window.webContents.on("will-redirect", event => {

            event.preventDefault();
        });
        window.webContents.on("will-frame-navigate", event => {

            event.preventDefault();
        });
        window.on("page-title-updated", event => {

            return void event.preventDefault();
        });
        window.once("ready-to-show", () => {

            return void window.show();
        });
        window.once("closed", () => {

            if (this.#window === window) {
                this.#window = undefined;
            }
        });
        this.load(window);
    }
    authorize(event: IpcMainInvokeEvent): void {

        if (!this.#window || this.#window.isDestroyed() || !isSettingsSender(event, this.#window.webContents)) {
            throw new OperationError(IpcErrorCode.PermissionDenied, "Settings requests require the settings window main frame.");
        }
    }
    changed(): void {

        if (this.#window && !this.#window.isDestroyed()) {
            this.#window.webContents.send(settingsChannels.changed);
        }
    }
    dispose(): void {

        this.#window?.destroy();
        this.#window = undefined;
    }
}

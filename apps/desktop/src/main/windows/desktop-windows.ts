import type { CanvasChange } from "../../shared/canvas/contracts";
import { canvasServiceChannels } from "../../shared/canvas/contracts";
import type { DesktopView } from "../../shared/canvas/views";
import { desktopViewChannels } from "../../shared/canvas/views";
import type { IpcMainInvokeEvent, WebContents } from "electron";
import { BrowserWindow, screen } from "electron";

export class DesktopWindows {
    readonly #canvases = new Map<string, BrowserWindow>();
    #controller?: BrowserWindow;
    #expanded = false;
    #quitting = false;
    constructor(private readonly preload: string, private readonly load: (window: BrowserWindow) => void, private readonly readTitle: (id: string) => Promise<string>, private readonly allowBlockURL: (owner: WebContents, url: string) => boolean) {

        screen.on("display-metrics-changed", this.#position);
        screen.on("display-removed", this.#position);
    }
    controller(): BrowserWindow {

        if (this.#controller && !this.#controller.isDestroyed()) {
            return this.#controller;
        }
        const window = new BrowserWindow({
            width: 204,
            height: 48,
            show: false,
            frame: false,
            transparent: true,
            resizable: false,
            maximizable: false,
            fullscreenable: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            title: "Avesd",
            webPreferences: this.#preferences(),
        });
        this.#controller = window;
        window.webContents.session.setPermissionRequestHandler((contents, permission, callback, details) => {

            callback(contents === this.#controller?.webContents && permission === "media" && details.isMainFrame
                && "mediaTypes" in details && details.mediaTypes?.length === 1 && details.mediaTypes[0] === "audio");
        });
        window.webContents.session.setPermissionCheckHandler((contents, permission, _origin, details) => {

            return contents === this.#controller?.webContents && permission === "media" && details.isMainFrame && details.mediaType === "audio";
        });
        window.setAlwaysOnTop(true, "floating");
        if (process.platform === "darwin") {
            window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        }
        window.once("ready-to-show", () => {

            window.showInactive();
        });
        window.on("close", event => {

            if (!this.#quitting) {
                event.preventDefault(); this.expand(false);
            }
        });
        this.#secure(window);
        this.#position();
        this.load(window);

        return window;
    }
    readonly #position = (): void => {

        const window = this.#controller;
        if (!window || window.isDestroyed()) {
            return;
        }
        const area = screen.getDisplayMatching(window.getBounds()).workArea;
        const width = Math.min(this.#expanded ? 420 : 204, area.width - 24);
        const height = Math.min(this.#expanded ? 640 : 48, area.height - 24);
        window.setBounds({
            x: area.x + area.width - width - 12,
            y: area.y + area.height - height - 12,
            width,
            height,
        });
    };
    expand(expanded: boolean): void {

        const window = this.controller();
        this.#expanded = expanded;
        this.#position();
        window.webContents.send(desktopViewChannels.changed);
        if (expanded) {
            window.show(); window.focus();
        } else {
            window.blur(); window.showInactive();
        }
    }
    async open(canvasId: string): Promise<DesktopView> {

        const title = await this.readTitle(canvasId);
        let window = this.#canvases.get(canvasId);
        if (!window || window.isDestroyed()) {
            window = new BrowserWindow({
                width: 1120,
                height: 760,
                minWidth: 560,
                minHeight: 400,
                show: false,
                title,
                backgroundColor: "#101b29",
                webPreferences: this.#preferences(),
            });
            const created = window;
            this.#canvases.set(canvasId, created);
            created.once("ready-to-show", () => {

                created.show();
            });
            created.once("closed", () => {

                this.#canvases.delete(canvasId); this.#notify();
            });
            this.#secure(created);
            this.load(created);
        } else {
            window.show(); window.focus();
        }
        this.#notify();

        return {
            viewId: window.id,
            canvasId,
        };
    }
    inspect(event: IpcMainInvokeEvent): DesktopView {

        if (event.senderFrame !== event.sender.mainFrame) {
            throw new Error("Desktop requests require a trusted main frame.");
        }
        const view = this.list().find(entry => {

            return BrowserWindow.fromId(entry.viewId)?.webContents === event.sender;
        });
        if (!view) {
            throw new Error("Desktop window is unavailable.");
        }

        return view;
    }
    list(): DesktopView[] {

        return [
            ...(this.#controller && !this.#controller.isDestroyed() ? [
                {
                    viewId: this.#controller.id,
                    expanded: this.#expanded,
                },
            ] : []),
            ...[...this.#canvases].map(([
                canvasId,
                window,
            ]) => {

                return {
                    viewId: window.id,
                    canvasId,
                };
            }),
        ];
    }
    focus(viewId: number): void {

        const view = this.list().find(item => {

            return item.viewId === viewId;
        });
        if (!view) {
            throw new Error("Window is unavailable.");
        }
        const window = BrowserWindow.fromId(viewId)!;
        window.show(); window.focus();
    }
    close(viewId: number): void {

        if (!this.list().some(item => {

            return item.viewId === viewId;
        })) {
            throw new Error("Window is unavailable.");
        }
        BrowserWindow.fromId(viewId)?.close();
    }
    changed(event: CanvasChange): void {

        for (const view of this.list()) {
            if (!view.canvasId || !event.canvasId || view.canvasId === event.canvasId) {
                BrowserWindow.fromId(view.viewId)?.webContents.send(canvasServiceChannels.changed, event);
            }
        }
        if (event.canvasId) {
            const window = this.#canvases.get(event.canvasId);
            if (window) {
                void this.readTitle(event.canvasId).then(title => {

                    if (!window.isDestroyed()) {
                        window.setTitle(title);
                    }
                })
                    .catch(() => {
                    });
            }
        }
    }
    dispose(): void {

        this.#quitting = true;
        screen.off("display-metrics-changed", this.#position);
        screen.off("display-removed", this.#position);
    }
    #notify(): void {

        this.#controller?.webContents.send(desktopViewChannels.changed);
    }
    #preferences() {

        return {
            preload: this.preload,
            contextIsolation: true,
            nodeIntegration: false,
            nodeIntegrationInSubFrames: false,
            webviewTag: false,
            navigateOnDragDrop: false,
            disableDialogs: true,
            sandbox: true,
        };
    }
    #secure(window: BrowserWindow): void {

        window.on("page-title-updated", event => {

            event.preventDefault();
        });

        window.webContents.setWindowOpenHandler(() => {

            return { action: "deny" };
        });
        window.webContents.on("will-frame-navigate", event => {

            if (event.isMainFrame || event.initiator !== window.webContents.mainFrame || !this.allowBlockURL(window.webContents, event.url)) {
                event.preventDefault();
            }
        });
        window.webContents.on("will-redirect", event => {

            event.preventDefault();
        });
        window.webContents.on("will-navigate", event => {

            event.preventDefault();
        });
    }
}

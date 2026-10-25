/**
 * @author Avesd
 * @package Desktop
 * @namespace Sandbox
 * @description Browser-only compatibility widget loader and cleanup
 */

(() => {

    type Identity = import("../shared/workspace/widget-workspace").WidgetWorkspaceIdentity;
    type Size = import("../shared/plugins/local-plugins").LocalPluginDraft["manifest"]["size"];
    interface Service {
        subscribe?: (listener: () => void) => () => void;
        [key: string]: unknown;
    }
    interface WidgetWindow extends Window {
        avesdWidget: {
            initialize(): Promise<Identity>;
            browser: Service;
        } & Record<string, Service | (() => Promise<Identity>)>;
        __avesdReady?: Promise<boolean>;
    }
    const widgetWindow = window as unknown as WidgetWindow;
    const load = async () => {

        const input = document.getElementById("widget-input");
        const host = document.getElementById("widget");
        if (!input?.textContent || !host) {
            throw new Error("Widget document is unavailable.");
        }
        // This JSON is serialized and escaped by the host, rather than evaluated as source.
        const draft = JSON.parse(input.textContent) as {
            source: string;
            browser: boolean;
            size: Size;
        };
        const errors: string[] = [];
        addEventListener("error", () => {

            errors.push("Uncaught widget error.");
        });
        addEventListener("unhandledrejection", () => {

            errors.push("Unhandled widget promise rejection.");
        });
        addEventListener("securitypolicyviolation", () => {

            errors.push("Widget attempted a blocked capability.");
        });
        const root = host.attachShadow({ mode: "open" });
        const signal = new AbortController();
        const url = URL.createObjectURL(new Blob([draft.source], { type: "text/javascript" }));
        try {
            const module: unknown = await import(/* @vite-ignore */ url);
            if (!module || typeof module !== "object" || !("mount" in module) || typeof module.mount !== "function") {
                throw new Error("Export a mount function.");
            }
            const identity = await widgetWindow.avesdWidget.initialize();
            const context: Record<string, unknown> = {
                signal: signal.signal,
                instanceId: identity.instanceId,
                workspaceId: identity.workspaceId,
                dashboardId: identity.dashboardId,
            };
            for (const capability of identity.capabilities) {
                // Manifest capability names address only services exposed by the narrow preload.
                const service = widgetWindow.avesdWidget[capability] as Service;
                const subscribe = service.subscribe?.bind(service);
                context[capability] = Object.freeze({
                    ...service,
                    ...(subscribe ? {
                        subscribe(listener: () => void) {

                            if (signal.signal.aborted) {
                                return () => {
                                };
                            }
                            const dispose = subscribe(() => {

                                if (!signal.signal.aborted) {
                                    listener();
                                }
                            });
                            const cleanup = () => {

                                dispose();
                                signal.signal.removeEventListener("abort", cleanup);
                            };
                            signal.signal.addEventListener("abort", cleanup, { once: true });

                            return cleanup;
                        },
                    } : {}),
                });
            }
            if (draft.browser) {
                context.browser = Object.freeze({ ...widgetWindow.avesdWidget.browser });
            }
            const controller: unknown = module.mount(root, Object.freeze(context));
            if (!controller || typeof controller !== "object"
                || !("update" in controller) || typeof controller.update !== "function"
                || !("dispose" in controller) || typeof controller.dispose !== "function") {
                throw new Error("mount must return update and dispose methods.");
            }
            // Call only validated plugin entry points, retaining their controller receiver.
            const update = controller.update.bind(controller);
            const dispose = controller.dispose.bind(controller);
            const state = {
                configuration: {},
                size: draft.size,
            };
            update(state);
            Object.defineProperty(window, "__avesdWidget", {
                value: Object.freeze({
                    errors,
                    update: (size = state.size) => {

                        state.size = size;
                        update(state);
                    },
                    dispose: () => {

                        signal.abort();
                        dispose();
                        root.replaceChildren();
                    },
                }),
            });
            await new Promise<void>(resolve => {

                requestAnimationFrame(() => {

                    requestAnimationFrame(() => {

                        resolve();
                    });
                });
            });

            return true;
        } finally {
            URL.revokeObjectURL(url);
        }
    };
    widgetWindow.__avesdReady = load();
    void widgetWindow.__avesdReady.catch(() => {
    });
})();

/**
 * @author Avesd
 * @package Desktop
 * @namespace Sandbox
 * @description Browser-only canvas block lifecycle and scoped DOM bridge
 */

(() => {

    type Snapshot = import("@avesd/desktop-contracts/canvas/blocks").BlockSnapshot;
    type Interaction = import("@avesd/desktop-contracts/canvas/blocks").CanvasSandboxInteraction;
    type Block = import("@avesd/workspace-model").DashboardBlock;
    type Callback = (...args: any[]) => any;
    interface BlockRecord {
        token: string;
        id: string;
        host: HTMLDivElement;
        root: ShadowRoot;
        snapshot: Snapshot;
        callbacks: Set<(snapshot: Snapshot) => void>;
        timers: Map<number | string, () => void>;
        listeners: (() => void)[];
        disposed: boolean;
        failed: boolean;
    }
    interface Slot {
        displayed?: BlockRecord;
        candidate?: BlockRecord;
        errorHost?: HTMLElement;
    }
    type Message = {
        type: "upsert";
        id: string;
        token: string;
        snapshot: Snapshot;
        bounds: Block["bounds"];
        source: Block["source"];
    } | {
        type: "snapshot";
        token: string;
        snapshot: Snapshot;
    } | {
        type: "layout";
        id: string;
        bounds: Block["bounds"];
    } | {
        type: "remove";
        id: string;
    } | {
        type: "viewport";
        x: number;
        y: number;
        zoom: number;
    } | {
        type: "result";
        token: string;
        requestId: string;
        ok: boolean;
        result?: unknown;
        error?: string;
    };
    const realWindow = window;
    const realDocument = document;
    const world = realDocument.getElementById("world");
    if (!world) {
        throw new Error("Canvas root is unavailable.");
    }
    const versions = new Map<string, BlockRecord>();
    const blocks = new Map<string, Slot>();
    const pending = new Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
        timer: number;
        token: string;
    }>();
    let port: MessagePort | undefined;
    let executing: BlockRecord | undefined;
    let pan: {
        x: number;
        y: number;
    } | undefined;
    // Capture the native getter before generated code can replace activation properties.
    const activation = (navigator as Partial<Pick<Navigator, "userActivation">>).userActivation;
    const activationGetter = activation && Object.getOwnPropertyDescriptor(Object.getPrototypeOf(activation), "isActive")?.get;
    const isUserActive: () => boolean = activationGetter ? activationGetter.bind(activation) : () => {

        return false;
    };
    const send = (message: unknown) => {

        port?.postMessage(message);
    };
    const error = (record: BlockRecord) => {

        if (record.disposed || record.failed) {
            return;
        }
        record.failed = true;
        for (const clear of record.timers.values()) {
            clear();
        }
        for (const cleanup of record.listeners) {
            cleanup();
        }
        const badge = realDocument.createElement("div");
        badge.setAttribute("role", "status");
        badge.textContent = "Block script failed";
        badge.style.cssText = "position:absolute;bottom:0;left:0;padding:4px 8px;background:#fff0ed;color:#a12920;font:12px system-ui;z-index:2147483647";
        record.root.append(badge);
        send({
            type: "error",
            token: record.token,
            error: "SCRIPT_ERROR",
        });
    };
    const guard = (record: BlockRecord, fn: Callback): Callback => {

        return function(this: unknown, ...args: unknown[]) {

            if (record.disposed || record.failed) {
                return;
            }
            try {
                const value: unknown = fn.apply(this, args);
                if (value && (typeof value === "object" || typeof value === "function") && "then" in value && typeof value.then === "function") {
                    void Promise.resolve(value).catch(() => {

                        error(record);
                    });
                }

                return value;
            } catch {
                error(record);
            }
        };
    };
    const dispose = (record: BlockRecord | undefined) => {

        if (!record || record.disposed) {
            return;
        }
        record.disposed = true;
        for (const clear of record.timers.values()) {
            clear();
        }
        for (const cleanup of record.listeners) {
            cleanup();
        }
        for (const [
            id,
            item,
        ] of pending) {
            if (item.token === record.token) {
                realWindow.clearTimeout(item.timer);
                pending.delete(id);
                item.reject(new Error("Block version was replaced."));
            }
        }
        record.callbacks.clear();
        record.host.remove();
        versions.delete(record.token);
    };
    const request = (record: BlockRecord, type: "action" | "state", payload: object): Promise<unknown> => {

        return new Promise((resolve, reject) => {

            if (record.disposed || record.failed) {
                reject(new Error("Block is not connected."));

                return;
            }
            if (type === "action" && !isUserActive()) {
                reject(new Error("Actions require a user interaction."));

                return;
            }
            const requestId = crypto.randomUUID();
            const timer = realWindow.setTimeout(() => {

                pending.delete(requestId);
                reject(new Error("Block request timed out."));
            }, 15000);
            pending.set(requestId, {
                resolve,
                reject,
                timer,
                token: record.token,
            });
            send({
                type,
                token: record.token,
                requestId,
                ...payload,
            });
        });
    };
    const scopedEvents = (record: BlockRecord, target: EventTarget) => {

        const registrations: {
            type: string;
            listener: EventListenerOrEventListenerObject;
            options?: boolean | AddEventListenerOptions;
            cleanup: () => void;
        }[] = [];
        const capture = (value?: boolean | EventListenerOptions) => {

            if (typeof value === "boolean") {
                return value;
            }

            return !!value?.capture;
        };

        return {
            addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {

                const callback = guard(record, typeof listener === "function" ? listener : (event: Event) => {

                    listener.handleEvent(event);
                });
                target.addEventListener(type, callback, options);
                const cleanup = () => {

                    target.removeEventListener(type, callback, options);
                };
                registrations.push({
                    type,
                    listener,
                    options,
                    cleanup,
                });
                record.listeners.push(cleanup);
            },
            removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) {

                for (const item of registrations) {
                    if (item.type === type && item.listener === listener && capture(item.options) === capture(options)) {
                        item.cleanup();
                    }
                }
            },
        };
    };
    const update = (record: BlockRecord | undefined, snapshot: Snapshot) => {

        if (!record || record.disposed || record.failed) {
            return;
        }
        record.snapshot = snapshot;
        for (const fn of record.callbacks) {
            guard(record, fn)(structuredClone(snapshot));
        }
    };
    const position = (record: BlockRecord, bounds: Block["bounds"]) => {

        Object.assign(record.host.style, {
            transform: `translate(${bounds.x}px,${bounds.y}px)`,
            width: `${bounds.width}px`,
            height: `${bounds.height}px`,
        });
    };
    const create = (message: Extract<Message, {
        type: "upsert";
    }>) => {

        const previous = blocks.get(message.id);
        dispose(previous?.candidate);
        previous?.errorHost?.remove();
        const host = realDocument.createElement("div");
        host.className = "block";
        host.dataset.blockId = message.id;
        host.style.visibility = "hidden";
        world.append(host);
        const root = host.attachShadow({ mode: "closed" });
        const record: BlockRecord = {
            token: message.token,
            id: message.id,
            host,
            root,
            snapshot: message.snapshot,
            callbacks: new Set(),
            timers: new Map(),
            listeners: [],
            disposed: false,
            failed: false,
        };
        versions.set(record.token, record);
        const slot: Slot = {
            displayed: previous?.displayed,
            candidate: record,
        };
        blocks.set(message.id, slot);
        position(record, message.bounds);
        const base = realDocument.createElement("style");
        base.textContent = ":host{color:#253c34;font:16px system-ui;color-scheme:light dark}*{box-sizing:border-box}html,body{margin:0;width:100%;min-height:100%}@media(prefers-color-scheme:dark){:host{color:#e7efeb}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}";
        const style = realDocument.createElement("style");
        style.textContent = message.source.css;
        const html = realDocument.createElement("html");
        const body = realDocument.createElement("body");
        body.innerHTML = message.source.html;
        html.append(body);
        root.append(base, style, html);
        const events = scopedEvents(record, root);
        const windowEvents = scopedEvents(record, realWindow);
        const localDocument = new Proxy(realDocument, {
            get(target, key) {

                if (key === "body") {
                    return body;
                }
                if (key === "documentElement") {
                    return html;
                }
                if (key === "head") {
                    return root;
                }
                if (key === "querySelector") {
                    return (selector: string) => {

                        return root.querySelector(selector);
                    };
                }
                if (key === "querySelectorAll") {
                    return (selector: string) => {

                        return root.querySelectorAll(selector);
                    };
                }
                if (key === "getElementById") {
                    return root.getElementById.bind(root);
                }
                if (key === "addEventListener") {
                    return events.addEventListener;
                }
                if (key === "removeEventListener") {
                    return events.removeEventListener;
                }
                const value: unknown = Reflect.get(target, key, target);

                return typeof value === "function" ? value.bind(target) : value;
            },
        });
        const timeout = (fn: Callback, delay?: number, ...args: unknown[]) => {

            const id = realWindow.setTimeout(() => {

                record.timers.delete(id);
                guard(record, fn)(...args);
            }, delay);
            record.timers.set(id, () => {

                realWindow.clearTimeout(id);
            });

            return id;
        };
        const interval = (fn: Callback, delay?: number, ...args: unknown[]) => {

            const id = realWindow.setInterval(guard(record, () => {

                fn(...args);
            }), delay);
            record.timers.set(id, () => {

                realWindow.clearInterval(id);
            });

            return id;
        };
        const animation = (fn: FrameRequestCallback) => {

            const id = realWindow.requestAnimationFrame(time => {

                record.timers.delete(`animation:${id}`);
                guard(record, fn)(time);
            });
            record.timers.set(`animation:${id}`, () => {

                realWindow.cancelAnimationFrame(id);
            });

            return id;
        };
        const clear = (id: number) => {

            realWindow.clearTimeout(id);
            realWindow.clearInterval(id);
            record.timers.delete(id);
        };
        const cancelAnimation = (id: number) => {

            realWindow.cancelAnimationFrame(id);
            record.timers.delete(`animation:${id}`);
        };
        const bridge = Object.freeze({
            onData(fn: (snapshot: Snapshot) => void) {

                record.callbacks.add(fn);
                guard(record, fn)(structuredClone(record.snapshot));

                return () => {

                    return record.callbacks.delete(fn);
                };
            },
            getSnapshot() {

                return structuredClone(record.snapshot);
            },
            action(actionId: string, input = {}) {

                return request(record, "action", {
                    actionId,
                    input,
                    expectedDataRevision: record.snapshot.dataRevision,
                    ...(record.snapshot.question ? { expectedQuestionRevision: record.snapshot.question.revision } : {}),
                });
            },
            saveState(state: unknown) {

                return request(record, "state", {
                    state,
                    expectedStateRevision: record.snapshot.stateRevision,
                });
            },
        });
        const overrides: Record<string, unknown> = {
            document: localDocument,
            avesBlock: bridge,
            setTimeout: timeout,
            setInterval: interval,
            clearTimeout: clear,
            clearInterval: clear,
            requestAnimationFrame: animation,
            cancelAnimationFrame: cancelAnimation,
            ...windowEvents,
        };
        const localWindow: Window = new Proxy(realWindow, {
            get(target, key) {

                if (key === "window" || key === "self" || key === "globalThis") {
                    return localWindow;
                }
                if (typeof key === "string" && Object.hasOwn(overrides, key)) {
                    return overrides[key];
                }
                const value: unknown = Reflect.get(target, key, target);

                return typeof value === "function" && !/^[A-Z]/u.test(String(key)) ? value.bind(target) : value;
            },
        });
        const entry = `__aves_${crypto.randomUUID().replaceAll("-", "")}`;
        // Generated source can call this temporary entry only while its script is being inserted.
        const entries = realWindow as unknown as Record<string, unknown>;
        entries[entry] = (fn: Callback) => {

            return guard(record, fn)(localWindow, localDocument, bridge, timeout, interval, clear, clear, animation, cancelAnimation, windowEvents.addEventListener, windowEvents.removeEventListener, localWindow, localWindow);
        };
        const script = realDocument.createElement("script");
        script.textContent = `globalThis[${JSON.stringify(entry)}](function(window,document,avesBlock,setTimeout,setInterval,clearTimeout,clearInterval,requestAnimationFrame,cancelAnimationFrame,addEventListener,removeEventListener,self,globalThis){"use strict";\n${message.source.js}\n});\n//# sourceURL=aves-block-code://${record.token}`;
        executing = record;
        try {
            root.append(script);
        } catch {
            error(record);
        } finally {
            executing = undefined;
            delete entries[entry];
            script.remove();
        }
        if (record.failed) {
            dispose(record);
            slot.candidate = undefined;
            if (!slot.displayed) {
                host.style.visibility = "";
                root.replaceChildren();
                const note = realDocument.createElement("div");
                note.setAttribute("role", "status");
                note.textContent = "Block could not be displayed";
                root.append(note);
                world.append(host);
                slot.errorHost = host;
            }

            return;
        }
        slot.errorHost?.remove();
        dispose(slot.displayed);
        slot.displayed = record;
        slot.candidate = undefined;
        host.style.visibility = "";
        send({
            type: "ready",
            token: record.token,
        });
    };
    const failedSource = (location: unknown) => {

        if (typeof location !== "string") {
            return;
        }
        for (const record of versions.values()) {
            if (location.includes(`aves-block-code://${record.token}`)) {
                return record;
            }
        }
    };
    realWindow.addEventListener("error", event => {

        const record = executing ?? failedSource(event.filename) ?? failedSource(event.error?.stack);
        if (record) {
            error(record);
            event.preventDefault();
        }
    });
    realWindow.addEventListener("unhandledrejection", event => {

        const record = failedSource(event.reason?.stack);
        if (record) {
            error(record);
            event.preventDefault();
        }
    });
    realWindow.addEventListener("message", (event: MessageEvent<unknown>) => {

        if (event.source !== parent || !event.data || typeof event.data !== "object" || !("type" in event.data)
            || event.data.type !== "aves:canvas:connect" || !event.ports[0] || port) {
            return;
        }
        port = event.ports[0];
        // The trusted parent owns this private port; generated blocks never receive it.
        port.onmessage = ({ data: message }: MessageEvent<Message>) => {

            switch (message.type) {
                case "upsert":
                    create(message);
                    break;
                case "snapshot":
                    update(versions.get(message.token), message.snapshot);
                    break;
                case "layout": {
                    const slot = blocks.get(message.id);
                    if (slot?.displayed) {
                        position(slot.displayed, message.bounds);
                    }
                    if (slot?.candidate) {
                        position(slot.candidate, message.bounds);
                    }
                    break;
                }
                case "remove": {
                    const slot = blocks.get(message.id);
                    dispose(slot?.candidate);
                    dispose(slot?.displayed);
                    slot?.errorHost?.remove();
                    blocks.delete(message.id);
                    break;
                }
                case "viewport":
                    world.style.transform = `translate(${message.x}px,${message.y}px) scale(${message.zoom})`;
                    break;
                case "result": {
                    const item = pending.get(message.requestId);
                    if (!item || item.token !== message.token) {
                        return;
                    }
                    pending.delete(message.requestId);
                    realWindow.clearTimeout(item.timer);
                    if (message.ok) {
                        item.resolve(message.result);
                    } else {
                        item.reject(new Error(message.error || "Block request failed."));
                    }
                    break;
                }
            }
        };
        port.start();
        send({ type: "connected" });
    });
    const interaction = (value: Interaction) => {

        send({
            type: "interaction",
            ...value,
        });
    };
    realDocument.addEventListener("wheel", event => {

        event.preventDefault();
        let unit = 1;
        if (event.deltaMode === 1) {
            unit = 16;
        } else if (event.deltaMode === 2) {
            unit = innerHeight;
        }
        interaction({
            kind: "wheel",
            x: event.clientX,
            y: event.clientY,
            delta: event.deltaY * unit,
        });
    }, { passive: false });
    realDocument.addEventListener("contextmenu", event => {

        event.preventDefault();
        interaction({
            kind: "menu",
            x: event.clientX,
            y: event.clientY,
        });
    });
    realDocument.addEventListener("pointerdown", event => {

        if (event.button !== 0 || event.composedPath().some(node => {

            return node instanceof HTMLElement && node.classList.contains("block");
        })) {
            return;
        }
        pan = {
            x: event.clientX,
            y: event.clientY,
        };
        realDocument.documentElement.setPointerCapture(event.pointerId);
    });
    realDocument.addEventListener("pointermove", event => {

        if (!pan) {
            return;
        }
        interaction({
            kind: "pan",
            dx: event.clientX - pan.x,
            dy: event.clientY - pan.y,
        });
        pan = {
            x: event.clientX,
            y: event.clientY,
        };
    });
    for (const type of [
        "pointerup",
        "pointercancel",
        "lostpointercapture",
    ]) {
        realDocument.addEventListener(type, () => {

            pan = undefined;
        });
    }
    realDocument.addEventListener("keydown", event => {

        let command: "controller" | "reset" | "escape" | undefined;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
            command = "controller";
        } else if ((event.metaKey || event.ctrlKey) && event.key === "0") {
            command = "reset";
        } else if (event.key === "Escape") {
            command = "escape";
        }
        if (command) {
            event.preventDefault();
            interaction({
                kind: "key",
                command,
            });
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
            event.preventDefault();
            interaction({
                kind: "menu",
                x: 160,
                y: 120,
            });
        }
    });
})();

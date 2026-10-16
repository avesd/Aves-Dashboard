/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Desktop Application
 */

import { agentProvidersChannels } from "../shared/agent/providers";
import { agentSessionsChannels, parseAgentRoute, parseAgentRoutes, parseAgentTier } from "../shared/agent/sessions";
import { browserControlsChannel, parseBrowserControls } from "../shared/browser/browser-controls";
import { browserTaskCommandSchema, browserTasksChanged, browserTasksChannel } from "../shared/browser/browser-tasks";
import { parseWebCommand, settleWebSurfaceCommand, webSurfaceChannel, webSurfaceEventChannel } from "../shared/browser/web-surface";
import { blockRuntimeRequestSchema, dashboardBlocksChannels } from "../shared/canvas/blocks";
import { canvasServiceChannels } from "../shared/canvas/contracts";
import { desktopViewChannels, viewRequestSchema } from "../shared/canvas/views";
import type { AgentWorkbenchContext } from "../shared/desktop-api";
import { agentIpcChannels,
    parseAgentPrompt,
    workspaceIpcChannels } from "../shared/desktop-api";
import { parseLocalWidgetCommand } from "../shared/plugins/local-plugins";
import { localPluginsChannels } from "../shared/plugins/local-plugins";
import { liveChannels, liveRequestSchema } from "../shared/voice/live";
import { workbenchPreferencesChannels } from "../shared/workbench/preferences";
import { parseWidgetWorkspaceRequest, widgetWorkspaceChannels } from "../shared/workspace/widget-workspace";
import { parseWorkspaceNavigation, workspaceNavigationChannel } from "../shared/workspace/workspace-navigation";
import { openAgentGateway } from "./agent/agent-gateway";
import { AgentPreferences } from "./agent/agent-preferences";
import { AgentSessions } from "./agent/agent-sessions";
import { AgentTaskBridge } from "./agent/agent-task-bridge";
import { DeepSeekAgentHost } from "./agent/deepseek-agent-host";
import { deepSeekProviders, probeDeepSeek, requireDeepSeek } from "./agent/deepseek-provider";
import { browserBindingFile } from "./browser/browser-binding-file";
import { BrowserBindings } from "./browser/browser-bindings";
import { BrowserTasks } from "./browser/browser-tasks";
import { PluginBrowserBridge } from "./browser/plugin-browser-bridge";
import { WebSurfaceManager } from "./browser/web-surface-manager";
import { CanvasService } from "./canvas/canvas-service";
import { canvasToolDefinitions, invokeCanvasTool } from "./canvas/canvas-tools";
import { DashboardBlockRuntime } from "./canvas/dashboard-block-runtime";
import { LocalPluginStore } from "./plugins/local-plugin-store";
import { LocalWidgetRunner } from "./plugins/local-widget-sandbox";
import { LocalWidgetSurfaces } from "./plugins/local-widget-surfaces";
import { closePluginStorageProcesses, PluginStorage } from "./storage/plugin-storage";
import { resourceDirectoryFile, SharedResources } from "./storage/shared-resources";
import { loadStoragePaths } from "./storage/storage-paths";
import { WorkspaceFile } from "./storage/workspace-file";
import { LiveVoice } from "./voice/live-voice";
import { DesktopWindows } from "./windows/desktop-windows";
import { WorkbenchPreferences } from "./workbench/preferences";
import { AgentWorkbench } from "./workspace/agent-workbench";
import { WidgetWorkspaceBridge } from "./workspace/widget-workspace-bridge";
import type { WidgetInstanceId } from "@avesd/workspace-model";
import type { WorkspaceSnapshot } from "@avesd/workspace-model";
import { sameDashboard } from "@avesd/workspace-model";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { app, dialog, ipcMain, protocol, shell } from "electron";
import { join } from "node:path";

export function startDesktop() {

    if (!app.requestSingleInstanceLock()) {
        app.quit();

        return Promise.resolve(undefined);
    }

    let workbenchPreferences: WorkbenchPreferences;
    let agentPreferences = new AgentPreferences();
    let agentHost: AgentSessions | undefined;
    let voice: LiveVoice | undefined;
    let mainWindow: BrowserWindow | undefined;
    protocol.registerSchemesAsPrivileged([
        {
            scheme: "aves-block",
            privileges: {
                standard: true,
                secure: true,
            },
        },
    ]);
    let canvasService: CanvasService | undefined;
    let blockRuntime: DashboardBlockRuntime | undefined;
    let windows: DesktopWindows | undefined;
    let workspaceFile: WorkspaceFile | undefined;
    let workbench: AgentWorkbench | undefined;
    let gateway: Awaited<ReturnType<typeof openAgentGateway>> | undefined;
    let localWidgetSurfaces: LocalWidgetSurfaces | undefined;
    const widgetWorkspaceBridge = new WidgetWorkspaceBridge();
    const localWidgetRunner = new LocalWidgetRunner(widgetWorkspaceBridge);
    let webSurfaces: WebSurfaceManager | undefined;
    let browserTasks: BrowserTasks | undefined;
    let browserBindings: BrowserBindings | undefined;

    const createMainWindow = (): BrowserWindow => {

        if (!windows) {
            throw new Error("Desktop windows are not ready.");
        }
        const window = windows.controller();
        mainWindow = window;
        window.webContents.on("render-process-gone", () => {

            return voice?.stop();
        });
        window.webContents.on("did-start-loading", () => {

            return voice?.stop();
        });
        window.on("closed", () => {

            return voice?.stop();
        });
        browserTasks?.attach(new WebSurfaceManager(window, () => {

            return workspaceFile!.load();
        }, () => {

            if (!window.isDestroyed()) {
                window.webContents.send(browserTasksChanged);
            }
        }));
        resetWindowServices(window);

        return window;
    };

    const agentTaskBridge = new AgentTaskBridge(() => {

        return agentHost;
    }, () => {

        return workbench;
    });

    const pluginBrowserBridge = new PluginBrowserBridge(() => {

        return webSurfaces;
    }, () => {

        return workspaceFile!.load();
    }, () => {

        return workbench?.plugins;
    });

    const resetWindowServices = (window: BrowserWindow): void => {

        webSurfaces?.dispose();
        localWidgetSurfaces?.dispose();
        localWidgetRunner.dispose();
        if (!workbench) {
            throw new Error("Workspace storage is not ready");
        }
        webSurfaces = new WebSurfaceManager(window, () => {

            return workspaceFile!.load();
        }, () => {

            if (!window.isDestroyed()) {
                window.webContents.send(webSurfaceEventChannel);
            }
        });
        localWidgetSurfaces = new LocalWidgetSurfaces(window, workbench.plugins, () => {

            return workspaceFile!.load();
        }, widgetWorkspaceBridge, workbench, pluginBrowserBridge, agentTaskBridge);
    };

    const hostForEvent = (event: IpcMainInvokeEvent): AgentSessions => {

        if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !agentHost) {
            throw new Error("Agent IPC request did not originate from the active window");
        }

        return agentHost;
    };

    ipcMain.handle(canvasServiceChannels.request, (event, input: unknown) => {

        if (!windows || !canvasService) {
            throw new Error("Canvas service is unavailable.");
        }
        const view = windows.inspect(event);

        return canvasService.execute({
            clientId: "desktop",
            canvasIds: view.canvasId ? [view.canvasId] : "all",
        }, input);
    });
    ipcMain.handle(dashboardBlocksChannels.request, (event, input: unknown) => {

        if (!windows || !blockRuntime) {
            throw new Error("Dashboard blocks are unavailable.");
        }
        const view = windows.inspect(event);
        if (!view.canvasId) {
            throw new Error("Only a canvas frame can operate block leases.");
        }

        return blockRuntime.invoke(event.sender, view.canvasId, blockRuntimeRequestSchema.parse(input));
    });
    ipcMain.handle(desktopViewChannels.request, async (event, input: unknown) => {

        if (!windows) {
            throw new Error("Desktop windows are unavailable.");
        }
        const source = windows.inspect(event);
        const request = viewRequestSchema.parse(input);
        if (request.type === "inspect") {
            return source;
        }
        if (request.type === "controller") {
            windows.expand(request.expanded);

            return;
        }
        if (source.canvasId && (request.type !== "close" || request.viewId !== source.viewId)) {
            throw new Error("This view cannot control other windows.");
        }
        switch (request.type) {
            case "list": return windows.list();
            case "open": return windows.open(request.canvasId);
            case "focus": return void windows.focus(request.viewId);
            case "close": return void windows.close(request.viewId);
        }
    });

    ipcMain.handle(widgetWorkspaceChannels.renderer, (event, instanceId: unknown, input: unknown) => {

        hostForEvent(event);
        if (typeof instanceId !== "string" || !workbench) {
            throw new Error("Widget instance is required.");
        }

        return workbench.invokeWidget(instanceId as WidgetInstanceId, parseWidgetWorkspaceRequest(input));
    });

    ipcMain.handle(workspaceNavigationChannel, (event, input: unknown) => {

        hostForEvent(event);
        if (!workbench) {
            throw new Error("Workspace is unavailable.");
        }

        return workbench.navigate(parseWorkspaceNavigation(input));
    });
    ipcMain.handle(workbenchPreferencesChannels.sessionGet, event => {

        hostForEvent(event);

        return workbenchPreferences.sessionPosition;
    });
    ipcMain.handle(workbenchPreferencesChannels.sessionSet, (event, position: unknown) => {

        hostForEvent(event);

        return workbenchPreferences.setSessionPosition(position);
    });
    ipcMain.handle(workbenchPreferencesChannels.get, event => {

        hostForEvent(event);

        return workbenchPreferences.side;
    });
    ipcMain.handle(workbenchPreferencesChannels.set, (event, side: unknown) => {

        hostForEvent(event);

        return workbenchPreferences.setSide(side);
    });

    ipcMain.handle(agentProvidersChannels.list, (event) => {

        hostForEvent(event);

        return deepSeekProviders();
    });
    ipcMain.handle(agentProvidersChannels.configure, (event) => {

        hostForEvent(event);
        throw new Error("Configure DeepSeek through the local environment file and restart Avesd.");
    });
    ipcMain.handle(agentProvidersChannels.setup, (event, id: unknown) => {

        hostForEvent(event);
        requireDeepSeek(id);

        return shell.openExternal("https://api-docs.deepseek.com/");
    });

    ipcMain.handle(liveChannels.command, (event, input: unknown) => {

        hostForEvent(event);
        if (!voice) {
            throw new Error("Voice is not ready.");
        }
        const request = liveRequestSchema.parse(input);
        switch (request.type) {
            case "availability": return voice.availability();
            case "start": return voice.start(request.connectionId, request.agentId, request.sdp);
            case "event": return void voice.event(request.connectionId, request.event);
            case "stop": return void voice.stop(request.connectionId);
            case "cancelTask": return voice.cancelTask(request.connectionId);
        }
    });
    ipcMain.handle(agentSessionsChannels.command, async (event, input: unknown) => {

        const sessions = hostForEvent(event);
        if (!input || typeof input !== "object" || !("type" in input)) {
            throw new Error("Invalid session command.");
        }
        const request = input as Record<string, unknown>;
        if (request.type === "probeRoute") {
            if (typeof request.test !== "boolean") {
                throw new Error("Invalid model check.");
            }
            const route = parseAgentRoute(request.route);
            requireDeepSeek(route.providerId);

            return probeDeepSeek(route, request.test);
        }
        if (request.type === "list") {
            return sessions.list();
        }
        if (request.type === "create") {
            const route = request.route === undefined ? undefined : parseAgentRoute(request.route);
            if (route) {
                requireDeepSeek(route.providerId);
            }

            return sessions.create(parseAgentTier(request.tier), undefined, route);
        }
        if (request.type === "routes") {
            return agentPreferences.routes;
        }
        if (request.type === "configure") {
            const routes = parseAgentRoutes(request.routes);
            for (const route of Object.values(routes)) { requireDeepSeek(route.providerId); }
            await agentPreferences.configureRoutes(routes);

            return;
        }
        if (typeof request.id !== "string" || request.id.length > 128) {
            throw new Error("Invalid session ID.");
        }
        switch (request.type) {
            case "read": return sessions.snapshot(request.id);
            case "select": return void sessions.select(request.id);
            case "connect": return sessions.connect(request.id);
            case "configureSession": {
                const route = parseAgentRoute(request.route);
                requireDeepSeek(route.providerId);

                return sessions.configureSession(request.id, route);
            }
            case "prompt": return sessions.prompt(parseAgentPrompt(request.text), request.id);
            case "enqueue": return sessions.enqueue(parseAgentPrompt(request.text), request.id);
            case "cancelTurn": return sessions.cancelTurn(request.id);
            case "cancel": return sessions.cancel(request.id);
            case "remove": return sessions.remove(request.id);
            default: throw new Error("Unknown session command.");
        }
    });
    ipcMain.handle("widget-agent:renderer", (event, widgetId: unknown, input: unknown) => {

        hostForEvent(event);
        if (typeof widgetId !== "string" || widgetId.length > 128) {
            throw new Error("Invalid widget ID.");
        }

        return agentTaskBridge.invoke(widgetId, input);
    });
    ipcMain.handle(agentIpcChannels.settings, event => {

        return hostForEvent(event).getSettings();
    });
    ipcMain.handle(agentIpcChannels.provider, (event, id: unknown) => {

        if (typeof id !== "string" || id.length > 64) {
            throw new Error("Invalid provider.");
        }

        return hostForEvent(event).selectProvider(id);
    });
    ipcMain.handle(agentIpcChannels.model, (event, id: unknown) => {

        if (typeof id !== "string" || id.length > 512) {
            throw new Error("Invalid model.");
        }

        return hostForEvent(event).selectModel(id);
    });
    ipcMain.handle(agentIpcChannels.connect, (event) => {

        return hostForEvent(event).connect();
    });
    ipcMain.handle(agentIpcChannels.effort, (event, id: unknown) => {

        if (typeof id !== "string" || id.length > 512) {
            throw new Error("Invalid reasoning effort.");
        }

        return hostForEvent(event).selectEffort(id);
    });
    ipcMain.handle(webSurfaceChannel, (event, input: unknown) => {

        hostForEvent(event);
        if (event.senderFrame !== mainWindow?.webContents.mainFrame || !webSurfaces) {
            throw new Error("Web commands require the host main frame.");
        }

        return settleWebSurfaceCommand(webSurfaces.command(parseWebCommand(input)));
    });
    ipcMain.handle(browserControlsChannel, async (event, input: unknown) => {

        hostForEvent(event);
        if (event.senderFrame !== mainWindow?.webContents.mainFrame || !browserBindings || !webSurfaces) {
            throw new Error("Browser controls require the host main frame.");
        }
        const command = parseBrowserControls(input);
        const snapshot = await workspaceFile?.load();
        if (!snapshot) {
            throw new Error("Workspace is unavailable.");
        }
        await browserBindings.prune(snapshot);
        switch (command.type) {
            case "list": return browserBindings.list(snapshot).filter((binding) => {

                return sameDashboard(binding, snapshot.selection);
            });
            case "bind":
                if (!snapshot.widgets.some((widget) => {

                    return widget.id === command.sourceId && sameDashboard(widget, snapshot.selection);
                })
            || !snapshot.widgets.some((widget) => {

                return widget.id === command.targetId && sameDashboard(widget, snapshot.selection);
            })) {
                    throw new Error("Browser bindings require the active dashboard.");
                }

                return browserBindings.bind(command, snapshot);
            case "unbind":
                if (!snapshot.widgets.some((widget) => {

                    return widget.id === command.sourceId && sameDashboard(widget, snapshot.selection);
                })) {
                    throw new Error("Browser bindings require the active dashboard.");
                }

                return browserBindings.unbind(command.sourceId, command.inputId);
            case "invoke": return webSurfaces.control(command, browserBindings);
        }
    });
    ipcMain.handle(agentIpcChannels.prompt, (event, input: unknown) =>
    {

        return hostForEvent(event).prompt(parseAgentPrompt(input));
    });
    ipcMain.handle(agentIpcChannels.cancel, (event) => {

        return hostForEvent(event).cancel();
    });
    ipcMain.handle(agentIpcChannels.configureWorkbench, (event, context: unknown) => {

        hostForEvent(event);
        if (!context || typeof context !== "object") {
            throw new TypeError("Agent workbench context must be an object");
        }
        workbench?.configure(context as AgentWorkbenchContext);
    });
    ipcMain.handle(workspaceIpcChannels.load, (event) => {

        hostForEvent(event);

        return workspaceFile?.load();
    });
    ipcMain.handle(workspaceIpcChannels.save, (event, snapshot: WorkspaceSnapshot, expected?: {
        snapshot: WorkspaceSnapshot | undefined;
    }) => {

        hostForEvent(event);
        if (!workbench) {
            throw new Error("Workspace storage is not ready");
        }

        return workbench.save(snapshot, expected);
    });

    ipcMain.handle(browserTasksChannel, async (event, input: unknown) => {

        hostForEvent(event);
        const workspaceId = (await workspaceFile?.load())?.selection?.workspaceId;
        if (!workspaceId || !browserTasks) {
            throw new Error("Background browsers are unavailable.");
        }

        return browserTasks.command(workspaceId, browserTaskCommandSchema.parse(input));
    });

    ipcMain.handle(localPluginsChannels.list, (event) => {

        hostForEvent(event);

        return workbench?.plugins.list() ?? [];
    });
    ipcMain.handle(localPluginsChannels.surface, (event, input: unknown) => {

        hostForEvent(event);
        const command = parseLocalWidgetCommand(input);
        if (!localWidgetSurfaces) {
            throw new Error("Local widgets are not ready.");
        }

        return localWidgetSurfaces.command(command);
    });

    const desktopReady = app.whenReady().then(async () => {

        if (process.platform === "darwin") {
            app.configureWebAuthn({ platformPasskeys: true });
        }

        let storagePaths;
        try {
            storagePaths = await loadStoragePaths(app.getPath("userData"), app.getPath("home"));
        } catch (error) {
            dialog.showErrorBox("Unable to start Avesd", `${error instanceof Error ? error.message : "Storage could not be initialized."}\n\nCheck .avesd/config.json in your home directory and restart Avesd.`);
            app.quit();

            return;
        }
        workbenchPreferences = await WorkbenchPreferences.open(join(storagePaths.dataDirectory, "workbench-preferences.json"));
        agentPreferences = await AgentPreferences.open(join(storagePaths.dataDirectory, "agent-preferences.json"));
        const privateStorage = new PluginStorage(storagePaths.dataDirectory);
        const resources = new SharedResources(resourceDirectoryFile(join(storagePaths.dataDirectory, "shared-resources-v1.json")), privateStorage, () => {

            widgetWorkspaceBridge.changed();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(widgetWorkspaceChannels.changed);
            }
        });
        workspaceFile = new WorkspaceFile(storagePaths.workspace);
        workbench = new AgentWorkbench(workspaceFile, new LocalPluginStore(storagePaths.plugins), () => {

            widgetWorkspaceBridge.changed();
            canvasService?.invalidate();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(workspaceIpcChannels.changed);
            }
        }, () => {

            gateway?.rotateToken();
            if (mainWindow && !mainWindow.isDestroyed()) {
                resetWindowServices(mainWindow);
            }
        }, privateStorage, resources);
        await workbench.navigate({ type: "inspect" });
        canvasService = new CanvasService(workspaceFile, () => {

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(workspaceIpcChannels.changed);
            }
        });
        blockRuntime = new DashboardBlockRuntime(canvasService, workspaceFile, {
            questionOwner: id => {

                return agentHost?.questionOwner(id);
            },
            questionActive: (owner, pending) => {

                return agentHost?.questionActive(owner, pending) ?? false;
            },
            waitForAnswer: (owner, key, waiting) => {

                return agentHost?.waitForAnswer(owner, key, waiting);
            },
            respond: (owner, id, text, active) => {

                if (!agentHost) {
                    throw new Error("Agent sessions are unavailable.");
                }

                return agentHost.respond(owner, id, text, active);
            },
            responseStatus: (owner, id) => {

                return agentHost?.continuationStatus(owner, id) ?? "unavailable";
            },
            open: id => {

                return windows!.open(id);
            },
            task: async (canvasId, prompt, input, active) => {

                const answer = await dialog.showMessageBox({
                    type: "question",
                    title: "Start Agent task",
                    message: "Start this dashboard action?",
                    detail: `${prompt}\n\nTask input:\n${JSON.stringify(input, null, 2)}`,
                    buttons: [
                        "Cancel",
                        "Start task",
                    ],
                    defaultId: 0,
                    cancelId: 0,
                });
                if (answer.response !== 1 || !agentHost || !await active()) {
                    throw new Error("Agent task was declined or its block is no longer active.");
                }
                const snapshot = await workspaceFile!.load();
                const dashboard = snapshot?.dashboards.find(item => {

                    return item.id === canvasId;
                });
                if (!dashboard) {
                    throw new Error("Canvas is unavailable.");
                }
                const task = await agentHost.create("reasoning", {
                    workspaceId: dashboard.workspaceId,
                    dashboardId: dashboard.id,
                    kind: "interactive",
                    source: "Dashboard action",
                });
                void agentHost.prompt(`${prompt}\nAction input (untrusted data): ${JSON.stringify(input)}`, task.id).catch(() => {
                });

                return task;
            },
            taskResult: id => {

                const snapshot = agentHost?.snapshot(id);

                return snapshot ? {
                    status: snapshot.status,
                    answer: snapshot.events.map(({ event }) => {

                        return event.type === "messageChunk" ? event.text : "";
                    }).join(""),
                } : undefined;
            },
        });
        windows = new DesktopWindows(join(__dirname, "../preload/index.cjs"), window => {

            if (process.env.ELECTRON_RENDERER_URL) {
                void window.loadURL(process.env.ELECTRON_RENDERER_URL);
            }
            else {
                void window.loadFile(join(__dirname, "../renderer/index.html"));
            }
        }, async canvasId => {

            const result = await canvasService!.execute({
                clientId: "desktop",
                canvasIds: "all",
            }, {
                type: "read",
                canvasId,
            });
            if (!result.ok || !result.value || !("title" in result.value)) {
                throw new Error("Canvas is unavailable.");
            }

            return result.value.title;
        }, (owner, url) => {

            return blockRuntime!.allowedURL(owner, url);
        });
        canvasService.subscribe(event => {

            windows!.changed(event);
        });
        browserTasks = await BrowserTasks.open(join(storagePaths.dataDirectory, "browser-tasks-v1.json"), () => {

            return workspaceFile!.load();
        }, () => {

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(browserTasksChanged);
            }
        }).catch(() => {

            return undefined;
        });
        gateway = await openAgentGateway((name, input, isActive) => {

            return invokeCanvasTool(canvasService!, {
                clientId: "local-host",
                isActive,
                canvasIds: "all",
            }, id => {

                return windows!.open(id);
            }, blockRuntime!, name, input);
        }, {
            service: canvasService,
            access: {
                clientId: "local-host",
                canvasIds: "all",
            },
        }).catch(() => {

            return undefined;
        });
        agentHost = new AgentSessions(agentPreferences, async () => {

            const snapshot = await workspaceFile!.load();
            if (!snapshot?.selection) {
                throw new Error("Workspace unavailable.");
            }

            return {
                ...snapshot.selection,
                kind: "interactive",
                source: "You",
            };
        }, async (origin, route, sessionId) => {

            requireDeepSeek(route.providerId);
            const interactive = origin.kind === "interactive" && !origin.widgetId;
            const host = new DeepSeekAgentHost({
                tools: interactive ? canvasToolDefinitions : {},
                authorize: executionId => {

                    return agentHost!.authorizeExecution(sessionId, executionId);
                },
                invoke: (name, input, isActive) => {

                    return invokeCanvasTool(canvasService!, {
                        clientId: sessionId,
                        canvasIds: "all",
                        isActive,
                    }, id => {

                        return windows!.open(id);
                    }, blockRuntime!, name, input);
                },
            });

            return {
                host,
                release() {},
            };
        }, change => {

            voice?.observe(change.id);

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(agentSessionsChannels.changed, change);
            }
        });
        voice = new LiveVoice(agentHost, (connectionId, command) => {

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(liveChannels.event, {
                    connectionId,
                    command,
                });
            }
        });
        agentHost.subscribe(event => {

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(agentIpcChannels.event, event);
            }
        });
        // Fail closed for browser controls without preventing the local dashboard from opening.
        browserBindings = await BrowserBindings.open(browserBindingFile(storagePaths.browserBindings))
            .catch(() => {

                return undefined;
            });
        createMainWindow();

        app.on("activate", () => {

            windows?.expand(true);
        });

        return gateway;
    });

    app.on("second-instance", () => {

        windows?.expand(true);
    });

    app.on("window-all-closed", () => {

        if (process.platform !== "darwin") {
            app.quit();
        }
    });

    app.on("before-quit", () => {

        voice?.stop();

        windows?.dispose();
        browserTasks?.detach();
        webSurfaces?.dispose();
        closePluginStorageProcesses();
        agentHost?.dispose();
        localWidgetRunner.dispose();
        localWidgetSurfaces?.dispose();
        blockRuntime?.dispose();
        gateway?.close();
    });

    return desktopReady;
}

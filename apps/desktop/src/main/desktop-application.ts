/**
 * @author Avesd
 * @package Desktop
 * @namespace Main
 * @description Desktop Application
 */

import { agentSessionsChannels } from "../shared/agent/sessions";
import { browserTasksChanged } from "../shared/browser/browser-tasks";
import { webSurfaceEventChannel } from "../shared/browser/web-surface";
import { agentIpcChannels, workspaceIpcChannels } from "../shared/desktop-api";
import { liveChannels } from "../shared/voice/live";
import { widgetWorkspaceChannels } from "../shared/workspace/widget-workspace";
import { openAgentGateway } from "./agent/agent-gateway";
import { AgentPreferences } from "./agent/agent-preferences";
import { AgentTaskBridge } from "./agent/agent-task-bridge";
import { DeepSeekAgentHost } from "./agent/deepseek-agent-host";
import { requireDeepSeek } from "./agent/deepseek-provider";
import { AgentSessions } from "./agent/sessions/agent-sessions";
import { browserBindingFile } from "./browser/browser-binding-file";
import { BrowserBindings } from "./browser/browser-bindings";
import { BrowserTasks } from "./browser/browser-tasks";
import { PluginBrowserBridge } from "./browser/plugin-browser-bridge";
import { WebSurfaceManager } from "./browser/web-surface-manager";
import { DashboardBlockRuntime } from "./canvas/blocks/block-runtime";
import { CanvasService } from "./canvas/canvas-service";
import { canvasToolDefinitions, invokeCanvasTool } from "./canvas/canvas-tools";
import { ApiKeyService } from "./credentials/api-key-service";
import { credentialFiles } from "./credentials/credential-file";
import { systemCredentialCipher } from "./credentials/system-credential-cipher";
import { registerAgentIpc } from "./ipc/agent-ipc";
import { registerBrowserIpc } from "./ipc/browser-ipc";
import { registerCanvasIpc } from "./ipc/canvas-ipc";
import { registerPluginsIpc } from "./ipc/plugins-ipc";
import { registerSettingsIpc } from "./ipc/settings-ipc";
import { registerVoiceIpc } from "./ipc/voice-ipc";
import { registerWorkspaceIpc } from "./ipc/workspace-ipc";
import { LocalPluginStore } from "./plugins/local-plugin-store";
import { LocalWidgetRunner } from "./plugins/local-widget-sandbox";
import { LocalWidgetSurfaces } from "./plugins/local-widget-surfaces";
import { closePluginStorageProcesses, PluginStorage } from "./storage/plugin-storage";
import { resourceDirectoryFile, SharedResources } from "./storage/shared-resources";
import { loadStoragePaths } from "./storage/storage-paths";
import { WorkspaceFile } from "./storage/workspace-file";
import { LiveVoice } from "./voice/live-voice";
import { assertControllerSender } from "./windows/controller-access";
import { DesktopWindows } from "./windows/desktop-windows";
import { SettingsWindow } from "./windows/settings-window";
import { WorkbenchPreferences } from "./workbench/preferences";
import { AgentWorkbench } from "./workspace/agent-workbench";
import { WidgetWorkspaceBridge } from "./workspace/widget-workspace-bridge";
import { IpcErrorCode, OperationError } from "@avesd/desktop-contracts/ipc-result";
import { settingsChannels } from "@avesd/desktop-contracts/settings";
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
    let apiKeys: ApiKeyService | undefined;
    let settingsWindow: SettingsWindow | undefined;
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
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Desktop windows are not ready.");
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
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Workspace storage is not ready");
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

    const authorizeController = (event: IpcMainInvokeEvent): void => {

        assertControllerSender(event, mainWindow);
    };
    const getAgentSessions = (): AgentSessions => {

        if (!agentHost) {
            throw new OperationError(IpcErrorCode.ServiceNotReady, "Agent sessions are unavailable.");
        }

        return agentHost;
    };

    // Resolve services per request: startup and window recreation replace these instances.
    registerCanvasIpc(ipcMain, () => {

        return {
            windows,
            canvasService,
            blockRuntime,
        };
    });
    registerWorkspaceIpc(ipcMain, () => {

        return {
            authorizeController,
            workbench,
            workbenchPreferences,
            workspaceFile,
        };
    });
    registerSettingsIpc(ipcMain, () => {

        return {
            apiKeys,
            authorizeController,
            settingsWindow,
            agentPreferences,
            openExternal: url => {

                return shell.openExternal(url);
            },
        };
    });
    registerAgentIpc(ipcMain, () => {

        return {
            apiKeys,
            authorizeController,
            getAgentSessions,
            agentPreferences,
            agentTaskBridge,
            openExternal: url => {

                return shell.openExternal(url);
            },
        };
    });
    registerVoiceIpc(ipcMain, () => {

        return {
            authorizeController,
            voice,
        };
    });
    registerBrowserIpc(ipcMain, () => {

        return {
            authorizeController,
            mainWindow,
            webSurfaces,
            browserBindings,
            workspaceFile,
            browserTasks,
        };
    });
    registerPluginsIpc(ipcMain, () => {

        return {
            authorizeController,
            workbench,
            localWidgetSurfaces,
        };
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
        apiKeys = new ApiKeyService(credentialFiles(join(app.getPath("userData"), "credentials-v1")), systemCredentialCipher, () => {

            settingsWindow?.changed();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(settingsChannels.changed);
            }
        });
        agentPreferences.subscribe(() => {

            settingsWindow?.changed();
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(settingsChannels.changed);
            }
        });
        settingsWindow = new SettingsWindow(join(__dirname, "../preload/settings.cjs"), window => {

            if (process.env.ELECTRON_RENDERER_URL) {
                void window.loadURL(new URL("settings.html", process.env.ELECTRON_RENDERER_URL).href);
            } else {
                void window.loadFile(join(__dirname, "../renderer/settings.html"));
            }
        });
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
                    throw new OperationError(IpcErrorCode.ServiceNotReady, "Agent sessions are unavailable.");
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
                    throw new OperationError(IpcErrorCode.ServiceNotReady, "Canvas is unavailable.");
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
        windows = new DesktopWindows(join(__dirname, "../preload/index.cjs"), (window, controller) => {

            if (process.env.ELECTRON_RENDERER_URL) {
                void window.loadURL(new URL(controller ? "controller.html" : "canvas.html", process.env.ELECTRON_RENDERER_URL).href);
            }
            else {
                void window.loadFile(join(__dirname, controller ? "../renderer/controller.html" : "../renderer/canvas.html"));
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
                throw new OperationError(IpcErrorCode.ServiceNotReady, "Canvas is unavailable.");
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
                throw new OperationError(IpcErrorCode.ServiceNotReady, "Workspace unavailable.");
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
                key: () => {

                    return apiKeys?.key("deepseek");
                },
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
        }, () => {

            return apiKeys?.key("openai");
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

        settingsWindow?.dispose();
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

/**
 * @author Avesd
 * @package Desktop
 * @namespace Root
 * @description Agent Workbench
 */

import type { AgentWorkbenchContext } from "../../shared/desktop-api";
import { localWidgetDefinition } from "../../shared/plugins/local-plugins";
import type { WidgetWorkspaceRequest, WidgetWorkspaceResult } from "../../shared/workspace/widget-workspace";
import { requiredWorkspaceCapability } from "../../shared/workspace/widget-workspace";
import type { LocalPluginStore } from "../plugins/local-plugin-store";
import type { PluginStorage } from "../storage/plugin-storage";
import type { SharedResources } from "../storage/shared-resources";
import type { WorkspaceFile } from "../storage/workspace-file";
import type { DashboardScope, WidgetInstanceId, WorkspaceNavigationCommand, WorkspaceNavigationState, WorkspaceSnapshot } from "@avesd/workspace-model";
import { navigateWorkspace, readWorkspaceCatalog, sameDashboard } from "@avesd/workspace-model";
import { randomUUID } from "node:crypto";

/** Compatibility workspace and widget services remain behind trusted host APIs. */
export class AgentWorkbench {
    #context?: AgentWorkbenchContext;
    #scope?: DashboardScope;
    #scopeEpoch = 0;
    #queue: Promise<unknown> = Promise.resolve();
    constructor(
        private readonly file: WorkspaceFile, readonly plugins: LocalPluginStore,
        private readonly workspaceChanged: () => void,
        private readonly scopeChanged: () => void = () => {
        }, private readonly storage?: PluginStorage, private readonly resources?: SharedResources,
    ) {}

    configure(context: AgentWorkbenchContext): void {

        this.#context = context;
    }

    async authorizeAgentWidget(instanceId: string): Promise<{
        widgetId: string;
        pluginId: string;
        workspaceId: string;
        dashboardId: string;
    }> {

        return this.#serial(async () => {

            const snapshot = await this.file.load();
            const widget = snapshot?.widgets.find(item => {

                return item.id === instanceId && sameDashboard(item, snapshot.selection);
            });
            if (!widget) {
                throw new Error("Agent caller is no longer active.");
            }
            const definition = widget.pluginId.startsWith("avesd.local.")
                ? localWidgetDefinition((await this.plugins.installed(widget.pluginId)).manifest)
                : this.#context?.widgetDefinitions.find(item => {

                    return item.pluginId === widget.pluginId && item.widgetTypeId === widget.widgetTypeId;
                });
            if (!definition?.capabilities?.includes("agent")) {
                throw new Error("Widget agent capability was not declared.");
            }

            return {
                widgetId: widget.id,
                pluginId: widget.pluginId,
                workspaceId: widget.workspaceId,
                dashboardId: widget.dashboardId,
            };
        });
    }

    save(snapshot: WorkspaceSnapshot, expected?: {
        snapshot: WorkspaceSnapshot | undefined;
    }): Promise<void> {

        return this.#serial(async () => {

            const current = await this.file.load();
            if (!sameDashboard(snapshot.selection, current?.selection)) {
                throw new Error("Use workspace navigation to change dashboards.");
            }
            await this.file.save(snapshot, expected);
            this.workspaceChanged();
        });
    }

    navigate(command: WorkspaceNavigationCommand): Promise<WorkspaceNavigationState> {

        return this.#serial(async () => {

            return this.#navigate(await this.file.load(), command);
        });
    }

    widgetWorkspace(request: WidgetWorkspaceRequest, authorize: (snapshot: WorkspaceSnapshot) => void | Promise<void>, storageOperation?: () => Promise<WidgetWorkspaceResult>): Promise<WidgetWorkspaceResult> {

        return this.#serial(async () => {

            const snapshot = await this.file.load();
            if (!snapshot) {
                throw new Error("Workspace is unavailable.");
            }
            // Authorization runs inside the write queue, including after any preceding switch.
            await authorize(snapshot);
            if (request.type === "files" || request.type === "sqlite" || request.type === "resources") {
                if (!storageOperation) {
                    throw new Error("Plugin storage is unavailable.");
                }

                return storageOperation();
            }
            if (request.type !== "command") {
                return readWorkspaceCatalog(snapshot, request);
            }
            await this.#navigate(snapshot, request.command);
        });
    }

    invokeWidget(instanceId: WidgetInstanceId, request: WidgetWorkspaceRequest, isActive: () => boolean = () => {

        return true;
    }): Promise<WidgetWorkspaceResult> {

        const epoch = this.#scopeEpoch;
        let identity: {
            workspaceId: string;
            pluginId: string;
        } | undefined;

        return this.widgetWorkspace(request, async (snapshot) => {

            const widget = snapshot.widgets.find(({ id }) => {

                return id === instanceId;
            });
            if (!widget || !sameDashboard(widget, snapshot.selection) || epoch !== this.#scopeEpoch || !isActive()) {
                throw new Error("Widget workspace context is no longer active.");
            }
            const definition = widget.pluginId.startsWith("avesd.local.")
                ? localWidgetDefinition((await this.plugins.installed(widget.pluginId)).manifest)
                : this.#context?.widgetDefinitions.find((item) => {

                    return item.pluginId === widget.pluginId && item.widgetTypeId === widget.widgetTypeId;
                });
            if (!definition?.capabilities?.includes(requiredWorkspaceCapability(request))) {
                throw new Error("Widget workspace capability was not granted.");
            }
            if (request.type === "resources" && request.operation === "publish"
        && !definition.capabilities.includes(request.publication.kind === "file" ? "files" : "sqlite")) {
                throw new Error("Publishing requires the private storage capability.");
            }
            if (!isActive()) {
                throw new Error("Widget workspace context is no longer active.");
            }
            identity = {
                workspaceId: widget.workspaceId,
                pluginId: widget.pluginId,
            };
        }, async () => {

            if (identity && request.type === "resources") {
                if (!this.resources) {
                    throw new Error("Resource directory is unavailable.");
                }

                return this.resources.invoke(identity, request, () => {

                    return epoch === this.#scopeEpoch && isActive();
                });
            }
            if (!identity || !this.storage || (request.type !== "files" && request.type !== "sqlite")) {
                throw new Error("Plugin storage is unavailable.");
            }

            return this.storage.invoke(identity, request, () => {

                return epoch === this.#scopeEpoch && isActive();
            });
        });
    }

    async #navigate(current: WorkspaceSnapshot | undefined, command: WorkspaceNavigationCommand): Promise<WorkspaceNavigationState> {

        const { snapshot, state } = await navigateWorkspace(current, command, randomUUID);
        const changed = JSON.stringify(snapshot) !== JSON.stringify(current);
        if (changed) {
            await this.file.save(snapshot, { snapshot: current });
        }
        if (!sameDashboard(this.#scope, state.scope)) {
            this.#scope = state.scope;
            this.#scopeEpoch += 1;
            this.scopeChanged();
        }
        if (changed) {
            this.workspaceChanged();
        }

        return state;
    }

    #serial<T>(operation: () => Promise<T>): Promise<T> {

        const work = this.#queue.then(operation);
        this.#queue = work.catch(() => {

            return undefined;
        });

        return work;
    }
}
